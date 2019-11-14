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

chrome.devtools.network.onRequestFinished.addListener(async (har) => {
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
                    console.log("own_slots updated");
                });
            });
        });
    }
});

btnBuild.addEventListener('click', () => {
    dataElement.innerHTML = "";

    chrome.tabs.query({active: true}, (tabs) => {
        if (tabs[0].url == kancolleUrl)
            buildKantai();
        else
            dataElement.innerHTML = "<h2>Not in kancolle tab.<h2>";
    });

});

function buildKantai() {
    chrome.storage.local.get(["own_decks", "own_ships", "own_slots"], function(data) {
        own_decks = data.own_decks;
        own_ships = data.own_ships;
        own_slots = data.own_slots;

        let decks = own_decks.map(deck => new Deck(deck));

        decks.map(deck => {
            let doc_deck = document.createElement('div');
            doc_deck.classList.add('deck');

            let doc_deck_name = document.createElement('div');
            doc_deck_name.classList.add('deck-name');
            doc_deck_name.innerText = deck.api_name;
            doc_deck_name.addEventListener('click', showHide);
            doc_deck.append(doc_deck_name);

            let doc_ships_list = document.createElement('div');
            doc_ships_list.classList.add('ships-list');

            deck.api_ship.filter(s => s != -1).map(ship => {
                let doc_ship = document.createElement('div');
                doc_ship.classList.add('ship');
                doc_ship.innerHTML = `<div><b>${ship.api_name} - ${ship.api_lv}</b></div>`;

                let doc_slots = document.createElement('div');
                doc_slots.classList.add('ship-slots');

                ship.api_slot.map(slot => {
                    let doc_slot = document.createElement('input');
                    doc_slot.type = 'text';
                    doc_slot.value = (typeof slot == "object") ?
                       `${slot.api_name} - ☆${slot.api_level} ${alvList[slot.api_alv]}` : '';

                    doc_slot.disabled = true;
                    doc_slots.append(doc_slot);
                });

                doc_ship.append(doc_slots);
                doc_ships_list.append(doc_ship);
            });
            doc_deck.append(doc_ships_list);
            dataElement.append(doc_deck);
        });
    });

}

function extractData(data, target=null) {
    let extract = JSON.stringify(data, target);
    return JSON.parse(extract);
}

function showHide() {
    this.parentElement.querySelector('.ships-list').hidden ^= true;
}

function Deck(deck) {
    this.api_name = deck.api_name;
    this.api_ship = deck.api_ship.filter(ship => ship > 0).map(ship => {
        return new Ship(own_ships.find(i => i.api_id == ship));
    });
}

function Ship(ship) {
    this.api_name = all_ships.find(i => i.api_id == ship.api_ship_id).api_name;
    
    this.api_lv = ship.api_lv;
    this.api_slot = ship.api_slot.concat(ship.api_slot_ex).map(slot => {
        let s = own_slots.find(i => i.api_id == slot);
        if (s)
            return new Slot(s);
        else
            return slot;
    });
}

function Slot(slot) {
    this.api_name = all_items.find(i => i.api_id == slot.api_slotitem_id).api_name;
    this.api_level = slot.api_level || 0;
    this.api_alv = slot.api_alv || 0;
}