const portRegex = /https*:\/\/(\d+\.*)+\/kcsapi\/api_port\/port/;
const equiptRegex = /https*:\/\/(\d+\.*)+\/kcsapi\/api_get_member\/(slot_item|require_info)/;
const factoryRegex = /https*:\/\/(\d+\.*)+\/kcsapi\/api_req_kousyou\/(createitem|getship|remodel_slot)/;
const urlRegex = /www\.dmm\.com\/netgame\/social\/-\/gadgets\/=\/app_id=854854\//;
const kancolleUrl = "http://www.dmm.com/netgame/social/-/gadgets/=/app_id=854854/";
const btnBuild = document.getElementById('btn-build');
let dataElement = document.getElementById('kantai-field');

// Parse data
const targetShip = [
    'api_id',
    'api_ship_id',
    'api_lv',
    'api_slot',
    'api_slot_ex',
    'api_slotnum'
];

const targetDeck = ['api_name', 'api_ship'];
const alvList = ['', '|', '||', '|||', '/', '//', '///', '>>'];

let own_ships = [];
let own_decks = [];
let own_slots = [];

chrome.devtools.network.onRequestFinished.addListener((har) => {
    const url = har.request.url;
    if (portRegex.test(url)) {

        har.getContent((body) => {
            let dataJSON = JSON.parse(body.slice(7)).api_data;

            let own_ships = extractData(dataJSON.api_ship, targetShip);
            let own_decks = extractData(dataJSON.api_deck_port, targetDeck);

            chrome.storage.local.set({"own_ships": own_ships, "own_decks": own_decks}, function() {
                console.log("Store OK");
                document.getElementById('get-ships').innerHTML = "Ships data updated!";
            });
            
        });
    } else if (equiptRegex.test(url)) {
        har.getContent((body) => {
            let dataJSON = JSON.parse(body.slice(7)).api_data;

            const own_slots = (dataJSON.api_slot_item) ? dataJSON.api_slot_item : dataJSON;

            chrome.storage.local.set({"own_slots": own_slots}, () => {
                document.getElementById('get-item').innerHTML = "Items data updated!";
            });
        });
    } else if (factoryRegex.test(url)) {
        har.getContent((body) => {
            let dataJSON = JSON.parse(body.slice(7)).api_data;

            chrome.storage.local.get(["own_slots"], function(data) {
                let own_slots = data.own_slots;
                if (dataJSON.api_after_slot) {
                    let t = own_slots.find(i => i.api_id == dataJSON.api_after_slot.api_id);
                    if (t) own_slots.api_level = t.api_level;
                } else if (dataJSON.api_slotitem) {
                    own_slots = own_slots.concat(dataJSON.api_slotitem);
                } else if (dataJSON.api_get_items) {
                    own_slots = own_slots.concat(dataJSON.api_get_items);
                }
                chrome.storage.local.set({"own_slots": own_slots}, () => {
                    console.log("OK");
                });
            });
        });
    }
});

btnBuild.addEventListener('click', () => {
    dataElement.innerHTML = "";

    chrome.storage.local.get(["own_decks", "own_ships", "own_slots"], function(data) {
        own_decks = data.own_decks;
        own_ships = data.own_ships;
        own_slots = data.own_slots;

        if (own_slots.length < 10)
            document.getElementById('get-item').innerHTML = "No items data";

        let decks = own_decks.map(deck => new Deck(deck));

        decks.map(deck => {
            let doc_deck = document.createElement('div');
            doc_deck.classList.add('deck');
            doc_deck.innerHTML = `<h3 class="deck-name">${deck.api_name}</h3>`;

            deck.api_ship.map(ship => {
                if (ship != -1) {
                    let doc_ship = document.createElement('div');
                    doc_ship.classList.add('ship');
                    doc_ship.innerHTML = `<div><b>${ship.api_name} - ${ship.api_lv}</b></div>`;

                    let doc_slots = document.createElement('div');
                    doc_slots.classList.add('ship-slots');
                    ship.api_slot.map(slot => {
                        let doc_slot = document.createElement('input');
                        doc_slot.type = 'text';
                        if (slot != -1) {
                            doc_slot.disabled = true;
                            doc_slot.value = `${slot.api_name} - ☆${slot.api_level}`;
                            if (slot.api_alv > 0) doc_slot.value += ` ${alvList[slot.api_alv]}`;
                        } else {
                            // doc_slot.disabled = true;
                            doc_slot.classList.add('disabled-input');
                        }
                        doc_slots.append(doc_slot);
                    });
                    doc_ship.append(doc_slots);
                    doc_deck.append(doc_ship);
                }
            });
            dataElement.append(doc_deck);
        });
    });

});

function extractData(data, target=null) {
    let extract = JSON.stringify(data, target);
    return JSON.parse(extract);
}

function Deck(deck) {
    this.api_name = deck.api_name;
    this.api_ship = deck.api_ship.map(ship => {
        return ship > 0 ?
            new Ship(own_ships.find(i => i.api_id == ship)) : ship;
    });
}

function Ship(ship) {
    this.api_name = all_ships.find(i => i.api_id == ship.api_ship_id).api_name;
    this.api_lv = ship.api_lv;
    this.api_slot = ship.api_slot.concat(ship.api_slot_ex).map(slot => {
        return slot > 0 ?
            new Slot(own_slots.find(i => i.api_id == slot)) : -1;
    });
}

function Slot(slot) {
    this.api_level = slot.api_level;
    this.api_alv = slot.api_alv ? slot.api_alv : 0;
    this.api_name = all_items.find(i => i.api_id == slot.api_slotitem_id).api_name;
}