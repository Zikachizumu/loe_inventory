--[[
    Loe — karakter panelindeki durum barlari
    -------------------------------------------
    Envanter aciklen CAN / ZIRH / ACLIK / SUSUZLUK degerlerini NUI'ye gonderir.
    Arayuz tarafinda store/playerStatus.ts bunu dinler; veri gelmezse panel
    durum blogunu hic gostermez (uydurma deger gosterilmez).

    Aclik/susuzluk framework'e (qbx_core) bagli oldugu icin pcall ile korunur;
    yoksa sadece can ve zirh gonderilir.
]]

local SEND_INTERVAL = 500 -- ms, yalnizca arayuz acikken
local IDLE_INTERVAL = 1000

--[[ ---------------------------------------------------------------------------
    GECICI TEST — canta seviyesi
    Gercek seviye markette satin alma / kraft ile belirlenecek ve DB'de
    saklanacak (sonraki adim). Su an tasarimi oyunda gormek icin client
    komutu: /cantatest <1-5>. NUI'ye setBagLevel gonderir (renk + kilitli
    slotlar). Backend baglaninca bu komut kaldirilacak.
-------------------------------------------------------------------------------]]
-- Gercek seviye: server 'loe:client:bagLevel' ile gonderir (DB'den).
-- Varsayilan 0 (cantasiz). /cantatest sadece GORSEL testtir (sunucuyu degistirmez).
local currentBagLevel = 0
local requestedFromServer = false

RegisterNetEvent('loe:client:bagLevel', function(level)
    level = tonumber(level) or 0
    currentBagLevel = level
    if IsNuiFocused() then
        SendNUIMessage({ action = 'setBagLevel', data = level })
    end
end)

-- Sadece gorsel test — gercek seviyeyi/agirligi degistirmez. Gercek icin /setcanta (server).
RegisterCommand('cantatest', function(_, args)
    local lvl = tonumber(args[1])

    if not lvl or lvl < 0 or lvl > 5 then
        return lib.notify({ type = 'error', description = 'Kullanim: /cantatest <0-5> (sadece gorsel test)' })
    end

    currentBagLevel = math.floor(lvl)
    SendNUIMessage({ action = 'setBagLevel', data = currentBagLevel })
    lib.notify({ type = 'inform', description = ('Canta seviyesi (GORSEL test): %d'):format(currentBagLevel) })
end, false)

--- Oyuncu canini 0-100 araligina cevirir (GTA'da 100 = olu, 200 = tam).
local function healthPercent(ped)
    local hp = GetEntityHealth(ped)
    local maxHp = GetEntityMaxHealth(ped)
    local span = maxHp - 100

    if span <= 0 then return 0 end

    local pct = ((hp - 100) / span) * 100

    return math.max(0, math.min(100, pct))
end

--- qbx_core metadata'sindan aclik/susuzluk okur. Yoksa nil doner.
local function survivalStats()
    local ok, data = pcall(function()
        return exports.qbx_core:GetPlayerData()
    end)

    if not ok or type(data) ~= 'table' then return nil, nil end

    local metadata = data.metadata

    if type(metadata) ~= 'table' then return nil, nil end

    return tonumber(metadata.hunger), tonumber(metadata.thirst)
end

--- qbx nakit (cash). Nakit artik envanter item'i DEGIL (GrandRP mantigi) ->
--- ust bar bunu qbx'ten okur. Yoksa nil.
local function cashAmount()
    local ok, data = pcall(function()
        return exports.qbx_core:GetPlayerData()
    end)
    if not ok or type(data) ~= 'table' or type(data.money) ~= 'table' then return nil end
    return tonumber(data.money.cash)
end

--[[
    Telefon artik envanter item'i DEGIL -> item ile enable/disable YOK. npwd
    telefonu HER ZAMAN acik tutulur (M tusu ile acilir, item aranmaz). Eski item
    kaldirildiginda telefon 'disabled' kalabilir; o yuzden oyuncu yuklenince bir
    kez enable edilir, relog/spawn'da tekrarlanir. pcall: npwd yoksa/farkli ise kirmasin.
    (npwd'nin kendi 'item gerektir' ayari varsa o da kapatilmali — npwd tarafinda.)
]]
local function enablePhone()
    pcall(function() exports.npwd:setPhoneDisabled(false) end)
end

CreateThread(function()
    -- Oyuncu (qbx) yuklenene kadar bekle, sonra telefonu ac.
    while true do
        local ok, data = pcall(function() return exports.qbx_core:GetPlayerData() end)
        if ok and type(data) == 'table' and data.citizenid then break end
        Wait(1000)
    end
    Wait(1500)
    enablePhone()
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', enablePhone)   -- relog (qbx compat)
RegisterNetEvent('qbx_core:client:playerLoggedIn', enablePhone) -- surum uyumu

--- O an kusanili silahi (ox currentWeapon tablosu: slot/name/label/...) dondurur.
--- ox client'inin getCurrentWeapon export'unu kullanir (kendi kaynagimiz). Yoksa nil.
local function equippedWeapon()
    local ok, weapon = pcall(function()
        return exports[GetCurrentResourceName()]:getCurrentWeapon()
    end)

    if not ok or type(weapon) ~= 'table' then return nil end

    return weapon
end

--- Kusanili silah payload'ini panele gonderir (setEquippedSlot + setEquippedWeapon).
local function pushEquippedWeapon(weapon)
    local wslot = weapon and weapon.slot or nil
    SendNUIMessage({ action = 'setEquippedSlot', data = wslot })
    SendNUIMessage({
        action = 'setEquippedWeapon',
        data = weapon
            and { name = weapon.name, label = weapon.label, slot = weapon.slot, ammo = weapon.ammo, mag = weapon.metadata and weapon.metadata.ammo or 0 }
            or false,
    })
end

--[[
    Loe: kusanili silah DEGISINCE karakter panelini ANINDA guncelle.

    ox 'ox_inventory:currentWeapon' event'i kusan / kilifa / mermi degisiminde
    tetiklenir. Durum thread'i bunu 500ms'de bir yolluyordu; kilifa alinca silah
    slotu (15) o gecikme kadar DOLU kaliyor, tasinan silah kisa sure 15'te
    "takili" gorunuyordu. Buradan aninda gonderince kilifa alma an'inda 15
    bosalir, silah dogrudan birakilan slotta gorunur (sicrama/gecikme yok).
    Yalniz envanter acikken (NUI odakli) gonderilir.
]]
AddEventHandler('ox_inventory:currentWeapon', function(weapon)
    if not IsNuiFocused() then return end
    pushEquippedWeapon(type(weapon) == 'table' and weapon or nil)
end)

CreateThread(function()
    local last
    local lastEquipped = false -- 'false' = henuz gonderilmedi (nil'den ayirt icin)
    local lastMag       -- sarjor mermisi (mag) son gonderilen deger
    local lastBagSent
    local lastCash

    while true do
        local wait = IDLE_INTERVAL

        -- Envanter acikken NUI odakli olur; sadece o zaman gonderiyoruz.
        if IsNuiFocused() then
            wait = SEND_INTERVAL

            -- Ilk acilista sunucudan gercek seviyeyi iste (push kacmis olabilir).
            if not requestedFromServer then
                requestedFromServer = true
                CreateThread(function()
                    local lvl = lib.callback.await('loe:server:getBagLevel', false)
                    if type(lvl) == 'number' then currentBagLevel = lvl end
                end)
            end

            -- Canta seviyesi — envanter her acildiginda tekrar gonderilir.
            if currentBagLevel ~= lastBagSent then
                lastBagSent = currentBagLevel
                SendNUIMessage({ action = 'setBagLevel', data = currentBagLevel })
            end

            -- Nakit (qbx cash) — artik envanter item'i degil, ust bar bunu gosterir.
            local cash = cashAmount()
            if cash ~= lastCash then
                lastCash = cash
                SendNUIMessage({ action = 'setCash', data = cash or 0 })
            end

            -- Kusanili silah: slot (sag tik menusunde Use/Unequip etiketi) + karakter
            -- panelindeki SILAH slotu gosterimi (name/label -> gorsel). Silah degisince
            -- (kusan/degis/holstered) ikisi de guncellenir. `false` = silah yok.
            --
            -- `ammo` = silahin MERMI ITEM ADI (Weapon.Equip -> item.ammo = data.ammoname,
            -- or. 'ammo-9'). Arayuz bununla envanterdeki mermi yiginini bulup MERMI
            -- slotunda (16) gosterir ve o slotu gridden gizler. Atilabilirlerde
            -- (`WEAPON_SNOWBALL` gibi) envanterde karsiligi yoktur, arayuz bos birakir.
            local weapon = equippedWeapon()
            local wslot = weapon and weapon.slot or nil
            -- `mag` = sarjordeki (yuklu) mermi. MERMI slotu (16) bunu envanterdeki
            -- yedek yiginla toplayip gosterir: "silaha ait toplam mermi". Sarjor
            -- her ateste degistigi icin slot degismese bile mag degisince yeniden
            -- gonderilir (yoksa 16 eski sayida takili kalir).
            local wmag = weapon and weapon.metadata and weapon.metadata.ammo or nil

            if wslot ~= lastEquipped or wmag ~= lastMag then
                lastEquipped = wslot
                lastMag = wmag
                SendNUIMessage({ action = 'setEquippedSlot', data = wslot })
                SendNUIMessage({
                    action = 'setEquippedWeapon',
                    data = weapon
                        and { name = weapon.name, label = weapon.label, slot = weapon.slot, ammo = weapon.ammo, mag = wmag or 0 }
                        or false,
                })
            end

            local ped = PlayerPedId()
            local hunger, thirst = survivalStats()

            local payload = {
                health = healthPercent(ped),
                armour = math.max(0, math.min(100, GetPedArmour(ped))),
                hunger = hunger,
                thirst = thirst,
            }

            -- Ayni degerleri tekrar tekrar gondermeyelim.
            local signature = ('%d|%d|%s|%s'):format(
                math.floor(payload.health),
                math.floor(payload.armour),
                tostring(hunger and math.floor(hunger)),
                tostring(thirst and math.floor(thirst))
            )

            if signature ~= last then
                last = signature
                SendNUIMessage({ action = 'setPlayerStatus', data = payload })
            end
        else
            last = nil
            lastEquipped = false
            lastMag = nil
            lastBagSent = nil
        end

        Wait(wait)
    end
end)

--[[
    GECICI TESHIS -- /mermibak
    -------------------------------------------------------------------------
    Kusanili silahin mermi durumunu 6 saniye boyunca yarim saniyede bir F8'e
    yazar. Komutu yazip silahla ates et; cikan satirlar nerede kirildigini
    soyler:

      item=N   -> ox'un takip ettigi mermi (silah metadata'si)
      ped=N    -> ped'in gercek mermisi (GetAmmoInPedWeapon)
      sarjor=N -> sarjordeki mermi

    ped mermisi DUSMUYORSA disaridan sinirsiz mermi veren bir sey var
    (vMenu 'unlimited ammo', qbx_adminmenu, baska bir resource).
    ped DUSUP item DUSMUYORSA ox'un atis sayimi (IsPedShooting) calismiyor.

    Isi bitince bu blogu sil.
]]
RegisterCommand('mermibak', function()
    local weapon = exports[GetCurrentResourceName()]:getCurrentWeapon()

    if type(weapon) ~= 'table' then
        return print('^3[loe] mermibak: elinde ox silahi yok.^7')
    end

    print(('^3[loe] mermibak basladi: %s (mermi item: %s)^7')
        :format(tostring(weapon.name), tostring(weapon.ammo)))

    CreateThread(function()
        for i = 1, 12 do
            local cur = exports[GetCurrentResourceName()]:getCurrentWeapon()
            if type(cur) ~= 'table' then
                print('^3[loe] mermibak: silah birakildi, olcum bitti.^7')
                return
            end

            local ped = PlayerPedId()
            local total = GetAmmoInPedWeapon(ped, cur.hash)
            local _, clip = GetAmmoInClip(ped, cur.hash)

            print(('^3[loe] mermibak %02d  item=%s  ped=%s  sarjor=%s  dayaniklilik=%s^7'):format(
                i,
                tostring(cur.metadata and cur.metadata.ammo),
                tostring(total),
                tostring(clip),
                tostring(cur.metadata and cur.metadata.durability)
            ))

            Wait(500)
        end

        print('^3[loe] mermibak bitti.^7')
    end)
end, false)
