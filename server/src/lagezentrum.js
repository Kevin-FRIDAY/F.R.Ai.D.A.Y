// Lagezentrum: weltweite Lage aus öffentlichen Quellen (Nachrichten pro Land + Erdbeben).
// Alle Daten sind frei zugänglich. Keine privaten oder nicht-öffentlichen Informationen.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { getPopulation, getAirQuality } from "./extras.js";

const client = new Anthropic({ apiKey: config.anthropicKey });

// Alle Länder (ISO-3166 numerische id passend zur Weltkarte), deutsche Namen, ungefähre Mitte.
export const COUNTRIES = [{"id":"004","name":"Afghanistan","en":"Afghanistan","lat":33,"lon":65,"cap":"Kabul","cur":"AFN","flag":"🇦🇫","region":"Asia","cca2":"AF"},{"id":"818","name":"Ägypten","en":"Egypt","lat":27,"lon":30,"cap":"Cairo","cur":"EGP","flag":"🇪🇬","region":"Africa","cca2":"EG"},{"id":"008","name":"Albanien","en":"Albania","lat":41,"lon":20,"cap":"Tirana","cur":"ALL","flag":"🇦🇱","region":"Europe","cca2":"AL"},{"id":"012","name":"Algerien","en":"Algeria","lat":28,"lon":3,"cap":"Algiers","cur":"DZD","flag":"🇩🇿","region":"Africa","cca2":"DZ"},{"id":"020","name":"Andorra","en":"Andorra","lat":42.5,"lon":1.5,"cap":"Andorra la Vella","cur":"EUR","flag":"🇦🇩","region":"Europe","cca2":"AD"},{"id":"024","name":"Angola","en":"Angola","lat":-12.5,"lon":18.5,"cap":"Luanda","cur":"AOA","flag":"🇦🇴","region":"Africa","cca2":"AO"},{"id":"028","name":"Antigua und Barbuda","en":"Antigua and Barbuda","lat":17.1,"lon":-61.8,"cap":"Saint John's","cur":"XCD","flag":"🇦🇬","region":"Americas","cca2":"AG"},{"id":"226","name":"Äquatorialguinea","en":"Equatorial Guinea","lat":2,"lon":10,"cap":"Malabo","cur":"XAF","flag":"🇬🇶","region":"Africa","cca2":"GQ"},{"id":"032","name":"Argentinien","en":"Argentina","lat":-34,"lon":-64,"cap":"Buenos Aires","cur":"ARS","flag":"🇦🇷","region":"Americas","cca2":"AR"},{"id":"051","name":"Armenien","en":"Armenia","lat":40,"lon":45,"cap":"Yerevan","cur":"AMD","flag":"🇦🇲","region":"Asia","cca2":"AM"},{"id":"031","name":"Aserbaidschan","en":"Azerbaijan","lat":40.5,"lon":47.5,"cap":"Baku","cur":"AZN","flag":"🇦🇿","region":"Asia","cca2":"AZ"},{"id":"231","name":"Äthiopien","en":"Ethiopia","lat":8,"lon":38,"cap":"Addis Ababa","cur":"ETB","flag":"🇪🇹","region":"Africa","cca2":"ET"},{"id":"036","name":"Australien","en":"Australia","lat":-27,"lon":133,"cap":"Canberra","cur":"AUD","flag":"🇦🇺","region":"Oceania","cca2":"AU"},{"id":"044","name":"Bahamas","en":"Bahamas","lat":24.3,"lon":-76,"cap":"Nassau","cur":"BSD","flag":"🇧🇸","region":"Americas","cca2":"BS"},{"id":"048","name":"Bahrain","en":"Bahrain","lat":26,"lon":50.5,"cap":"Manama","cur":"BHD","flag":"🇧🇭","region":"Asia","cca2":"BH"},{"id":"050","name":"Bangladesch","en":"Bangladesh","lat":24,"lon":90,"cap":"Dhaka","cur":"BDT","flag":"🇧🇩","region":"Asia","cca2":"BD"},{"id":"052","name":"Barbados","en":"Barbados","lat":13.2,"lon":-59.5,"cap":"Bridgetown","cur":"BBD","flag":"🇧🇧","region":"Americas","cca2":"BB"},{"id":"112","name":"Belarus","en":"Belarus","lat":53,"lon":28,"cap":"Minsk","cur":"BYN","flag":"🇧🇾","region":"Europe","cca2":"BY"},{"id":"056","name":"Belgien","en":"Belgium","lat":50.8,"lon":4,"cap":"Brussels","cur":"EUR","flag":"🇧🇪","region":"Europe","cca2":"BE"},{"id":"084","name":"Belize","en":"Belize","lat":17.3,"lon":-88.8,"cap":"Belmopan","cur":"BZD","flag":"🇧🇿","region":"Americas","cca2":"BZ"},{"id":"204","name":"Benin","en":"Benin","lat":9.5,"lon":2.3,"cap":"Porto-Novo","cur":"XOF","flag":"🇧🇯","region":"Africa","cca2":"BJ"},{"id":"064","name":"Bhutan","en":"Bhutan","lat":27.5,"lon":90.5,"cap":"Thimphu","cur":"BTN","flag":"🇧🇹","region":"Asia","cca2":"BT"},{"id":"068","name":"Bolivien","en":"Bolivia","lat":-17,"lon":-65,"cap":"Sucre","cur":"BOB","flag":"🇧🇴","region":"Americas","cca2":"BO"},{"id":"070","name":"Bosnien und Herzegowina","en":"Bosnia and Herzegovina","lat":44,"lon":18,"cap":"Sarajevo","cur":"BAM","flag":"🇧🇦","region":"Europe","cca2":"BA"},{"id":"072","name":"Botswana","en":"Botswana","lat":-22,"lon":24,"cap":"Gaborone","cur":"BWP","flag":"🇧🇼","region":"Africa","cca2":"BW"},{"id":"076","name":"Brasilien","en":"Brazil","lat":-10,"lon":-55,"cap":"Brasília","cur":"BRL","flag":"🇧🇷","region":"Americas","cca2":"BR"},{"id":"096","name":"Brunei","en":"Brunei","lat":4.5,"lon":114.7,"cap":"Bandar Seri Begawan","cur":"BND","flag":"🇧🇳","region":"Asia","cca2":"BN"},{"id":"100","name":"Bulgarien","en":"Bulgaria","lat":43,"lon":25,"cap":"Sofia","cur":"BGN","flag":"🇧🇬","region":"Europe","cca2":"BG"},{"id":"854","name":"Burkina Faso","en":"Burkina Faso","lat":13,"lon":-2,"cap":"Ouagadougou","cur":"XOF","flag":"🇧🇫","region":"Africa","cca2":"BF"},{"id":"108","name":"Burundi","en":"Burundi","lat":-3.5,"lon":30,"cap":"Gitega","cur":"BIF","flag":"🇧🇮","region":"Africa","cca2":"BI"},{"id":"152","name":"Chile","en":"Chile","lat":-30,"lon":-71,"cap":"Santiago","cur":"CLP","flag":"🇨🇱","region":"Americas","cca2":"CL"},{"id":"156","name":"China","en":"China","lat":35,"lon":105,"cap":"Beijing","cur":"CNY","flag":"🇨🇳","region":"Asia","cca2":"CN"},{"id":"188","name":"Costa Rica","en":"Costa Rica","lat":10,"lon":-84,"cap":"San José","cur":"CRC","flag":"🇨🇷","region":"Americas","cca2":"CR"},{"id":"384","name":"Côte d'Ivoire","en":"Ivory Coast","lat":8,"lon":-5,"cap":"Yamoussoukro","cur":"XOF","flag":"🇨🇮","region":"Africa","cca2":"CI"},{"id":"208","name":"Dänemark","en":"Denmark","lat":56,"lon":10,"cap":"Copenhagen","cur":"DKK","flag":"🇩🇰","region":"Europe","cca2":"DK"},{"id":"276","name":"Deutschland","en":"Germany","lat":51,"lon":9,"cap":"Berlin","cur":"EUR","flag":"🇩🇪","region":"Europe","cca2":"DE"},{"id":"212","name":"Dominica","en":"Dominica","lat":15.4,"lon":-61.3,"cap":"Roseau","cur":"XCD","flag":"🇩🇲","region":"Americas","cca2":"DM"},{"id":"214","name":"Dominikanische Republik","en":"Dominican Republic","lat":19,"lon":-70.7,"cap":"Santo Domingo","cur":"DOP","flag":"🇩🇴","region":"Americas","cca2":"DO"},{"id":"262","name":"Dschibuti","en":"Djibouti","lat":11.5,"lon":43,"cap":"Djibouti","cur":"DJF","flag":"🇩🇯","region":"Africa","cca2":"DJ"},{"id":"218","name":"Ecuador","en":"Ecuador","lat":-2,"lon":-77.5,"cap":"Quito","cur":"USD","flag":"🇪🇨","region":"Americas","cca2":"EC"},{"id":"222","name":"El Salvador","en":"El Salvador","lat":13.8,"lon":-88.9,"cap":"San Salvador","cur":"USD","flag":"🇸🇻","region":"Americas","cca2":"SV"},{"id":"232","name":"Eritrea","en":"Eritrea","lat":15,"lon":39,"cap":"Asmara","cur":"ERN","flag":"🇪🇷","region":"Africa","cca2":"ER"},{"id":"233","name":"Estland","en":"Estonia","lat":59,"lon":26,"cap":"Tallinn","cur":"EUR","flag":"🇪🇪","region":"Europe","cca2":"EE"},{"id":"242","name":"Fidschi","en":"Fiji","lat":-18,"lon":175,"cap":"Suva","cur":"FJD","flag":"🇫🇯","region":"Oceania","cca2":"FJ"},{"id":"246","name":"Finnland","en":"Finland","lat":64,"lon":26,"cap":"Helsinki","cur":"EUR","flag":"🇫🇮","region":"Europe","cca2":"FI"},{"id":"250","name":"Frankreich","en":"France","lat":46,"lon":2,"cap":"Paris","cur":"EUR","flag":"🇫🇷","region":"Europe","cca2":"FR"},{"id":"266","name":"Gabun","en":"Gabon","lat":-1,"lon":11.8,"cap":"Libreville","cur":"XAF","flag":"🇬🇦","region":"Africa","cca2":"GA"},{"id":"270","name":"Gambia","en":"Gambia","lat":13.5,"lon":-16.6,"cap":"Banjul","cur":"GMD","flag":"🇬🇲","region":"Africa","cca2":"GM"},{"id":"268","name":"Georgien","en":"Georgia","lat":42,"lon":43.5,"cap":"Tbilisi","cur":"GEL","flag":"🇬🇪","region":"Asia","cca2":"GE"},{"id":"288","name":"Ghana","en":"Ghana","lat":8,"lon":-2,"cap":"Accra","cur":"GHS","flag":"🇬🇭","region":"Africa","cca2":"GH"},{"id":"308","name":"Grenada","en":"Grenada","lat":12.1,"lon":-61.7,"cap":"St. George's","cur":"XCD","flag":"🇬🇩","region":"Americas","cca2":"GD"},{"id":"300","name":"Griechenland","en":"Greece","lat":39,"lon":22,"cap":"Athens","cur":"EUR","flag":"🇬🇷","region":"Europe","cca2":"GR"},{"id":"320","name":"Guatemala","en":"Guatemala","lat":15.5,"lon":-90.3,"cap":"Guatemala City","cur":"GTQ","flag":"🇬🇹","region":"Americas","cca2":"GT"},{"id":"324","name":"Guinea","en":"Guinea","lat":11,"lon":-10,"cap":"Conakry","cur":"GNF","flag":"🇬🇳","region":"Africa","cca2":"GN"},{"id":"624","name":"Guinea-Bissau","en":"Guinea-Bissau","lat":12,"lon":-15,"cap":"Bissau","cur":"XOF","flag":"🇬🇼","region":"Africa","cca2":"GW"},{"id":"328","name":"Guyana","en":"Guyana","lat":5,"lon":-59,"cap":"Georgetown","cur":"GYD","flag":"🇬🇾","region":"Americas","cca2":"GY"},{"id":"332","name":"Haiti","en":"Haiti","lat":19,"lon":-72.4,"cap":"Port-au-Prince","cur":"HTG","flag":"🇭🇹","region":"Americas","cca2":"HT"},{"id":"340","name":"Honduras","en":"Honduras","lat":15,"lon":-86.5,"cap":"Tegucigalpa","cur":"HNL","flag":"🇭🇳","region":"Americas","cca2":"HN"},{"id":"344","name":"Hongkong","en":"Hong Kong","lat":22.3,"lon":114.2,"cap":"City of Victoria","cur":"HKD","flag":"🇭🇰","region":"Asia","cca2":"HK"},{"id":"356","name":"Indien","en":"India","lat":20,"lon":77,"cap":"New Delhi","cur":"INR","flag":"🇮🇳","region":"Asia","cca2":"IN"},{"id":"360","name":"Indonesien","en":"Indonesia","lat":-5,"lon":120,"cap":"Jakarta","cur":"IDR","flag":"🇮🇩","region":"Asia","cca2":"ID"},{"id":"368","name":"Irak","en":"Iraq","lat":33,"lon":44,"cap":"Baghdad","cur":"IQD","flag":"🇮🇶","region":"Asia","cca2":"IQ"},{"id":"364","name":"Iran","en":"Iran","lat":32,"lon":53,"cap":"Tehran","cur":"IRR","flag":"🇮🇷","region":"Asia","cca2":"IR"},{"id":"372","name":"Irland","en":"Ireland","lat":53,"lon":-8,"cap":"Dublin","cur":"EUR","flag":"🇮🇪","region":"Europe","cca2":"IE"},{"id":"352","name":"Island","en":"Iceland","lat":65,"lon":-18,"cap":"Reykjavik","cur":"ISK","flag":"🇮🇸","region":"Europe","cca2":"IS"},{"id":"376","name":"Israel","en":"Israel","lat":31.5,"lon":35.1,"cap":"Jerusalem","cur":"ILS","flag":"🇮🇱","region":"Asia","cca2":"IL"},{"id":"380","name":"Italien","en":"Italy","lat":42.8,"lon":12.8,"cap":"Rome","cur":"EUR","flag":"🇮🇹","region":"Europe","cca2":"IT"},{"id":"388","name":"Jamaika","en":"Jamaica","lat":18.3,"lon":-77.5,"cap":"Kingston","cur":"JMD","flag":"🇯🇲","region":"Americas","cca2":"JM"},{"id":"392","name":"Japan","en":"Japan","lat":36,"lon":138,"cap":"Tokyo","cur":"JPY","flag":"🇯🇵","region":"Asia","cca2":"JP"},{"id":"887","name":"Jemen","en":"Yemen","lat":15,"lon":48,"cap":"Sana'a","cur":"YER","flag":"🇾🇪","region":"Asia","cca2":"YE"},{"id":"400","name":"Jordanien","en":"Jordan","lat":31,"lon":36,"cap":"Amman","cur":"JOD","flag":"🇯🇴","region":"Asia","cca2":"JO"},{"id":"116","name":"Kambodscha","en":"Cambodia","lat":13,"lon":105,"cap":"Phnom Penh","cur":"KHR","flag":"🇰🇭","region":"Asia","cca2":"KH"},{"id":"120","name":"Kamerun","en":"Cameroon","lat":6,"lon":12,"cap":"Yaoundé","cur":"XAF","flag":"🇨🇲","region":"Africa","cca2":"CM"},{"id":"124","name":"Kanada","en":"Canada","lat":60,"lon":-95,"cap":"Ottawa","cur":"CAD","flag":"🇨🇦","region":"Americas","cca2":"CA"},{"id":"132","name":"Kap Verde","en":"Cape Verde","lat":16,"lon":-24,"cap":"Praia","cur":"CVE","flag":"🇨🇻","region":"Africa","cca2":"CV"},{"id":"398","name":"Kasachstan","en":"Kazakhstan","lat":48,"lon":68,"cap":"Astana","cur":"KZT","flag":"🇰🇿","region":"Asia","cca2":"KZ"},{"id":"634","name":"Katar","en":"Qatar","lat":25.5,"lon":51.3,"cap":"Doha","cur":"QAR","flag":"🇶🇦","region":"Asia","cca2":"QA"},{"id":"404","name":"Kenia","en":"Kenya","lat":1,"lon":38,"cap":"Nairobi","cur":"KES","flag":"🇰🇪","region":"Africa","cca2":"KE"},{"id":"417","name":"Kirgisistan","en":"Kyrgyzstan","lat":41,"lon":75,"cap":"Bishkek","cur":"KGS","flag":"🇰🇬","region":"Asia","cca2":"KG"},{"id":"296","name":"Kiribati","en":"Kiribati","lat":1.4,"lon":173,"cap":"South Tarawa","cur":"AUD","flag":"🇰🇮","region":"Oceania","cca2":"KI"},{"id":"170","name":"Kolumbien","en":"Colombia","lat":4,"lon":-72,"cap":"Bogotá","cur":"COP","flag":"🇨🇴","region":"Americas","cca2":"CO"},{"id":"174","name":"Komoren","en":"Comoros","lat":-12.2,"lon":44.3,"cap":"Moroni","cur":"KMF","flag":"🇰🇲","region":"Africa","cca2":"KM"},{"id":"178","name":"Kongo","en":"Republic of the Congo","lat":-1,"lon":15,"cap":"Brazzaville","cur":"XAF","flag":"🇨🇬","region":"Africa","cca2":"CG"},{"id":"180","name":"Kongo (Dem. Rep.)","en":"DR Congo","lat":0,"lon":25,"cap":"Kinshasa","cur":"CDF","flag":"🇨🇩","region":"Africa","cca2":"CD"},{"id":"191","name":"Kroatien","en":"Croatia","lat":45.2,"lon":15.5,"cap":"Zagreb","cur":"EUR","flag":"🇭🇷","region":"Europe","cca2":"HR"},{"id":"192","name":"Kuba","en":"Cuba","lat":21.5,"lon":-80,"cap":"Havana","cur":"CUC","flag":"🇨🇺","region":"Americas","cca2":"CU"},{"id":"414","name":"Kuwait","en":"Kuwait","lat":29.5,"lon":45.8,"cap":"Kuwait City","cur":"KWD","flag":"🇰🇼","region":"Asia","cca2":"KW"},{"id":"418","name":"Laos","en":"Laos","lat":18,"lon":105,"cap":"Vientiane","cur":"LAK","flag":"🇱🇦","region":"Asia","cca2":"LA"},{"id":"426","name":"Lesotho","en":"Lesotho","lat":-29.5,"lon":28.5,"cap":"Maseru","cur":"LSL","flag":"🇱🇸","region":"Africa","cca2":"LS"},{"id":"428","name":"Lettland","en":"Latvia","lat":57,"lon":25,"cap":"Riga","cur":"EUR","flag":"🇱🇻","region":"Europe","cca2":"LV"},{"id":"422","name":"Libanon","en":"Lebanon","lat":33.8,"lon":35.8,"cap":"Beirut","cur":"LBP","flag":"🇱🇧","region":"Asia","cca2":"LB"},{"id":"430","name":"Liberia","en":"Liberia","lat":6.5,"lon":-9.5,"cap":"Monrovia","cur":"LRD","flag":"🇱🇷","region":"Africa","cca2":"LR"},{"id":"434","name":"Libyen","en":"Libya","lat":25,"lon":17,"cap":"Tripoli","cur":"LYD","flag":"🇱🇾","region":"Africa","cca2":"LY"},{"id":"438","name":"Liechtenstein","en":"Liechtenstein","lat":47.3,"lon":9.5,"cap":"Vaduz","cur":"CHF","flag":"🇱🇮","region":"Europe","cca2":"LI"},{"id":"440","name":"Litauen","en":"Lithuania","lat":56,"lon":24,"cap":"Vilnius","cur":"EUR","flag":"🇱🇹","region":"Europe","cca2":"LT"},{"id":"442","name":"Luxemburg","en":"Luxembourg","lat":49.8,"lon":6.2,"cap":"Luxembourg","cur":"EUR","flag":"🇱🇺","region":"Europe","cca2":"LU"},{"id":"450","name":"Madagaskar","en":"Madagascar","lat":-20,"lon":47,"cap":"Antananarivo","cur":"MGA","flag":"🇲🇬","region":"Africa","cca2":"MG"},{"id":"454","name":"Malawi","en":"Malawi","lat":-13.5,"lon":34,"cap":"Lilongwe","cur":"MWK","flag":"🇲🇼","region":"Africa","cca2":"MW"},{"id":"458","name":"Malaysia","en":"Malaysia","lat":2.5,"lon":112.5,"cap":"Kuala Lumpur","cur":"MYR","flag":"🇲🇾","region":"Asia","cca2":"MY"},{"id":"462","name":"Malediven","en":"Maldives","lat":3.3,"lon":73,"cap":"Malé","cur":"MVR","flag":"🇲🇻","region":"Asia","cca2":"MV"},{"id":"466","name":"Mali","en":"Mali","lat":17,"lon":-4,"cap":"Bamako","cur":"XOF","flag":"🇲🇱","region":"Africa","cca2":"ML"},{"id":"470","name":"Malta","en":"Malta","lat":35.8,"lon":14.6,"cap":"Valletta","cur":"EUR","flag":"🇲🇹","region":"Europe","cca2":"MT"},{"id":"504","name":"Marokko","en":"Morocco","lat":32,"lon":-5,"cap":"Rabat","cur":"MAD","flag":"🇲🇦","region":"Africa","cca2":"MA"},{"id":"584","name":"Marshallinseln","en":"Marshall Islands","lat":9,"lon":168,"cap":"Majuro","cur":"USD","flag":"🇲🇭","region":"Oceania","cca2":"MH"},{"id":"478","name":"Mauretanien","en":"Mauritania","lat":20,"lon":-12,"cap":"Nouakchott","cur":"MRU","flag":"🇲🇷","region":"Africa","cca2":"MR"},{"id":"480","name":"Mauritius","en":"Mauritius","lat":-20.3,"lon":57.5,"cap":"Port Louis","cur":"MUR","flag":"🇲🇺","region":"Africa","cca2":"MU"},{"id":"484","name":"Mexiko","en":"Mexico","lat":23,"lon":-102,"cap":"Mexico City","cur":"MXN","flag":"🇲🇽","region":"Americas","cca2":"MX"},{"id":"583","name":"Mikronesien","en":"Micronesia","lat":6.9,"lon":158.3,"cap":"Palikir","flag":"🇫🇲","region":"Oceania","cca2":"FM"},{"id":"498","name":"Moldawien","en":"Moldova","lat":47,"lon":29,"cap":"Chișinău","cur":"MDL","flag":"🇲🇩","region":"Europe","cca2":"MD"},{"id":"492","name":"Monaco","en":"Monaco","lat":43.7,"lon":7.4,"cap":"Monaco","cur":"EUR","flag":"🇲🇨","region":"Europe","cca2":"MC"},{"id":"496","name":"Mongolei","en":"Mongolia","lat":46,"lon":105,"cap":"Ulan Bator","cur":"MNT","flag":"🇲🇳","region":"Asia","cca2":"MN"},{"id":"499","name":"Montenegro","en":"Montenegro","lat":42.5,"lon":19.3,"cap":"Podgorica","cur":"EUR","flag":"🇲🇪","region":"Europe","cca2":"ME"},{"id":"508","name":"Mosambik","en":"Mozambique","lat":-18.3,"lon":35,"cap":"Maputo","cur":"MZN","flag":"🇲🇿","region":"Africa","cca2":"MZ"},{"id":"104","name":"Myanmar","en":"Myanmar","lat":22,"lon":98,"cap":"Naypyidaw","cur":"MMK","flag":"🇲🇲","region":"Asia","cca2":"MM"},{"id":"516","name":"Namibia","en":"Namibia","lat":-22,"lon":17,"cap":"Windhoek","cur":"NAD","flag":"🇳🇦","region":"Africa","cca2":"NA"},{"id":"520","name":"Nauru","en":"Nauru","lat":-0.5,"lon":166.9,"cap":"Yaren","cur":"AUD","flag":"🇳🇷","region":"Oceania","cca2":"NR"},{"id":"524","name":"Nepal","en":"Nepal","lat":28,"lon":84,"cap":"Kathmandu","cur":"NPR","flag":"🇳🇵","region":"Asia","cca2":"NP"},{"id":"554","name":"Neuseeland","en":"New Zealand","lat":-41,"lon":174,"cap":"Wellington","cur":"NZD","flag":"🇳🇿","region":"Oceania","cca2":"NZ"},{"id":"558","name":"Nicaragua","en":"Nicaragua","lat":13,"lon":-85,"cap":"Managua","cur":"NIO","flag":"🇳🇮","region":"Americas","cca2":"NI"},{"id":"528","name":"Niederlande","en":"Netherlands","lat":52.5,"lon":5.8,"cap":"Amsterdam","cur":"EUR","flag":"🇳🇱","region":"Europe","cca2":"NL"},{"id":"562","name":"Niger","en":"Niger","lat":16,"lon":8,"cap":"Niamey","cur":"XOF","flag":"🇳🇪","region":"Africa","cca2":"NE"},{"id":"566","name":"Nigeria","en":"Nigeria","lat":10,"lon":8,"cap":"Abuja","cur":"NGN","flag":"🇳🇬","region":"Africa","cca2":"NG"},{"id":"408","name":"Nordkorea","en":"North Korea","lat":40,"lon":127,"cap":"Pyongyang","cur":"KPW","flag":"🇰🇵","region":"Asia","cca2":"KP"},{"id":"807","name":"Nordmazedonien","en":"North Macedonia","lat":41.8,"lon":22,"cap":"Skopje","cur":"MKD","flag":"🇲🇰","region":"Europe","cca2":"MK"},{"id":"578","name":"Norwegen","en":"Norway","lat":62,"lon":10,"cap":"Oslo","cur":"NOK","flag":"🇳🇴","region":"Europe","cca2":"NO"},{"id":"512","name":"Oman","en":"Oman","lat":21,"lon":57,"cap":"Muscat","cur":"OMR","flag":"🇴🇲","region":"Asia","cca2":"OM"},{"id":"040","name":"Österreich","en":"Austria","lat":47.3,"lon":13.3,"cap":"Vienna","cur":"EUR","flag":"🇦🇹","region":"Europe","cca2":"AT"},{"id":"626","name":"Osttimor","en":"Timor-Leste","lat":-8.8,"lon":125.9,"cap":"Dili","cur":"USD","flag":"🇹🇱","region":"Asia","cca2":"TL"},{"id":"586","name":"Pakistan","en":"Pakistan","lat":30,"lon":70,"cap":"Islamabad","cur":"PKR","flag":"🇵🇰","region":"Asia","cca2":"PK"},{"id":"275","name":"Palästina","en":"Palestine","lat":31.9,"lon":35.2,"cap":"Ramallah","cur":"EGP","flag":"🇵🇸","region":"Asia","cca2":"PS"},{"id":"585","name":"Palau","en":"Palau","lat":7.5,"lon":134.5,"cap":"Ngerulmud","cur":"USD","flag":"🇵🇼","region":"Oceania","cca2":"PW"},{"id":"591","name":"Panama","en":"Panama","lat":9,"lon":-80,"cap":"Panama City","cur":"PAB","flag":"🇵🇦","region":"Americas","cca2":"PA"},{"id":"598","name":"Papua-Neuguinea","en":"Papua New Guinea","lat":-6,"lon":147,"cap":"Port Moresby","cur":"PGK","flag":"🇵🇬","region":"Oceania","cca2":"PG"},{"id":"600","name":"Paraguay","en":"Paraguay","lat":-23,"lon":-58,"cap":"Asunción","cur":"PYG","flag":"🇵🇾","region":"Americas","cca2":"PY"},{"id":"604","name":"Peru","en":"Peru","lat":-10,"lon":-76,"cap":"Lima","cur":"PEN","flag":"🇵🇪","region":"Americas","cca2":"PE"},{"id":"608","name":"Philippinen","en":"Philippines","lat":13,"lon":122,"cap":"Manila","cur":"PHP","flag":"🇵🇭","region":"Asia","cca2":"PH"},{"id":"616","name":"Polen","en":"Poland","lat":52,"lon":20,"cap":"Warsaw","cur":"PLN","flag":"🇵🇱","region":"Europe","cca2":"PL"},{"id":"620","name":"Portugal","en":"Portugal","lat":39.5,"lon":-8,"cap":"Lisbon","cur":"EUR","flag":"🇵🇹","region":"Europe","cca2":"PT"},{"id":"646","name":"Ruanda","en":"Rwanda","lat":-2,"lon":30,"cap":"Kigali","cur":"RWF","flag":"🇷🇼","region":"Africa","cca2":"RW"},{"id":"642","name":"Rumänien","en":"Romania","lat":46,"lon":25,"cap":"Bucharest","cur":"RON","flag":"🇷🇴","region":"Europe","cca2":"RO"},{"id":"643","name":"Russland","en":"Russia","lat":60,"lon":100,"cap":"Moscow","cur":"RUB","flag":"🇷🇺","region":"Europe","cca2":"RU"},{"id":"090","name":"Salomonen","en":"Solomon Islands","lat":-8,"lon":159,"cap":"Honiara","cur":"SBD","flag":"🇸🇧","region":"Oceania","cca2":"SB"},{"id":"894","name":"Sambia","en":"Zambia","lat":-15,"lon":30,"cap":"Lusaka","cur":"ZMW","flag":"🇿🇲","region":"Africa","cca2":"ZM"},{"id":"882","name":"Samoa","en":"Samoa","lat":-13.6,"lon":-172.3,"cap":"Apia","cur":"WST","flag":"🇼🇸","region":"Oceania","cca2":"WS"},{"id":"674","name":"San Marino","en":"San Marino","lat":43.8,"lon":12.4,"cap":"City of San Marino","cur":"EUR","flag":"🇸🇲","region":"Europe","cca2":"SM"},{"id":"678","name":"São Tomé und Príncipe","en":"São Tomé and Príncipe","lat":1,"lon":7,"cap":"São Tomé","cur":"STN","flag":"🇸🇹","region":"Africa","cca2":"ST"},{"id":"682","name":"Saudi-Arabien","en":"Saudi Arabia","lat":25,"lon":45,"cap":"Riyadh","cur":"SAR","flag":"🇸🇦","region":"Asia","cca2":"SA"},{"id":"752","name":"Schweden","en":"Sweden","lat":62,"lon":15,"cap":"Stockholm","cur":"SEK","flag":"🇸🇪","region":"Europe","cca2":"SE"},{"id":"756","name":"Schweiz","en":"Switzerland","lat":47,"lon":8,"cap":"Bern","cur":"CHF","flag":"🇨🇭","region":"Europe","cca2":"CH"},{"id":"686","name":"Senegal","en":"Senegal","lat":14,"lon":-14,"cap":"Dakar","cur":"XOF","flag":"🇸🇳","region":"Africa","cca2":"SN"},{"id":"688","name":"Serbien","en":"Serbia","lat":44,"lon":21,"cap":"Belgrade","cur":"RSD","flag":"🇷🇸","region":"Europe","cca2":"RS"},{"id":"690","name":"Seychellen","en":"Seychelles","lat":-4.6,"lon":55.7,"cap":"Victoria","cur":"SCR","flag":"🇸🇨","region":"Africa","cca2":"SC"},{"id":"694","name":"Sierra Leone","en":"Sierra Leone","lat":8.5,"lon":-11.5,"cap":"Freetown","cur":"SLL","flag":"🇸🇱","region":"Africa","cca2":"SL"},{"id":"716","name":"Simbabwe","en":"Zimbabwe","lat":-20,"lon":30,"cap":"Harare","cur":"BWP","flag":"🇿🇼","region":"Africa","cca2":"ZW"},{"id":"702","name":"Singapur","en":"Singapore","lat":1.4,"lon":103.8,"cap":"Singapore","cur":"SGD","flag":"🇸🇬","region":"Asia","cca2":"SG"},{"id":"703","name":"Slowakei","en":"Slovakia","lat":48.7,"lon":19.5,"cap":"Bratislava","cur":"EUR","flag":"🇸🇰","region":"Europe","cca2":"SK"},{"id":"705","name":"Slowenien","en":"Slovenia","lat":46.1,"lon":14.8,"cap":"Ljubljana","cur":"EUR","flag":"🇸🇮","region":"Europe","cca2":"SI"},{"id":"706","name":"Somalia","en":"Somalia","lat":10,"lon":49,"cap":"Mogadishu","cur":"SOS","flag":"🇸🇴","region":"Africa","cca2":"SO"},{"id":"724","name":"Spanien","en":"Spain","lat":40,"lon":-4,"cap":"Madrid","cur":"EUR","flag":"🇪🇸","region":"Europe","cca2":"ES"},{"id":"144","name":"Sri Lanka","en":"Sri Lanka","lat":7,"lon":81,"cap":"Colombo","cur":"LKR","flag":"🇱🇰","region":"Asia","cca2":"LK"},{"id":"659","name":"St. Kitts und Nevis","en":"Saint Kitts and Nevis","lat":17.3,"lon":-62.8,"cap":"Basseterre","cur":"XCD","flag":"🇰🇳","region":"Americas","cca2":"KN"},{"id":"662","name":"St. Lucia","en":"Saint Lucia","lat":13.9,"lon":-61,"cap":"Castries","cur":"XCD","flag":"🇱🇨","region":"Americas","cca2":"LC"},{"id":"670","name":"St. Vincent und die Grenadinen","en":"Saint Vincent and the Grenadines","lat":13.3,"lon":-61.2,"cap":"Kingstown","cur":"XCD","flag":"🇻🇨","region":"Americas","cca2":"VC"},{"id":"710","name":"Südafrika","en":"South Africa","lat":-29,"lon":24,"cap":"Pretoria","cur":"ZAR","flag":"🇿🇦","region":"Africa","cca2":"ZA"},{"id":"729","name":"Sudan","en":"Sudan","lat":15,"lon":30,"cap":"Khartoum","cur":"SDG","flag":"🇸🇩","region":"Africa","cca2":"SD"},{"id":"410","name":"Südkorea","en":"South Korea","lat":37,"lon":127.5,"cap":"Seoul","cur":"KRW","flag":"🇰🇷","region":"Asia","cca2":"KR"},{"id":"728","name":"Südsudan","en":"South Sudan","lat":7,"lon":30,"cap":"Juba","cur":"SSP","flag":"🇸🇸","region":"Africa","cca2":"SS"},{"id":"740","name":"Suriname","en":"Suriname","lat":4,"lon":-56,"cap":"Paramaribo","cur":"SRD","flag":"🇸🇷","region":"Americas","cca2":"SR"},{"id":"748","name":"Swasiland","en":"Eswatini","lat":-26.5,"lon":31.5,"cap":"Lobamba","cur":"SZL","flag":"🇸🇿","region":"Africa","cca2":"SZ"},{"id":"760","name":"Syrien","en":"Syria","lat":35,"lon":38,"cap":"Damascus","cur":"SYP","flag":"🇸🇾","region":"Asia","cca2":"SY"},{"id":"762","name":"Tadschikistan","en":"Tajikistan","lat":39,"lon":71,"cap":"Dushanbe","cur":"TJS","flag":"🇹🇯","region":"Asia","cca2":"TJ"},{"id":"158","name":"Taiwan","en":"Taiwan","lat":23.5,"lon":121,"cap":"Taipei","cur":"TWD","flag":"🇹🇼","region":"Asia","cca2":"TW"},{"id":"834","name":"Tansania","en":"Tanzania","lat":-6,"lon":35,"cap":"Dodoma","cur":"TZS","flag":"🇹🇿","region":"Africa","cca2":"TZ"},{"id":"764","name":"Thailand","en":"Thailand","lat":15,"lon":100,"cap":"Bangkok","cur":"THB","flag":"🇹🇭","region":"Asia","cca2":"TH"},{"id":"768","name":"Togo","en":"Togo","lat":8,"lon":1.2,"cap":"Lomé","cur":"XOF","flag":"🇹🇬","region":"Africa","cca2":"TG"},{"id":"776","name":"Tonga","en":"Tonga","lat":-20,"lon":-175,"cap":"Nuku'alofa","cur":"TOP","flag":"🇹🇴","region":"Oceania","cca2":"TO"},{"id":"780","name":"Trinidad und Tobago","en":"Trinidad and Tobago","lat":11,"lon":-61,"cap":"Port of Spain","cur":"TTD","flag":"🇹🇹","region":"Americas","cca2":"TT"},{"id":"148","name":"Tschad","en":"Chad","lat":15,"lon":19,"cap":"N'Djamena","cur":"XAF","flag":"🇹🇩","region":"Africa","cca2":"TD"},{"id":"203","name":"Tschechien","en":"Czechia","lat":49.8,"lon":15.5,"cap":"Prague","cur":"CZK","flag":"🇨🇿","region":"Europe","cca2":"CZ"},{"id":"788","name":"Tunesien","en":"Tunisia","lat":34,"lon":9,"cap":"Tunis","cur":"TND","flag":"🇹🇳","region":"Africa","cca2":"TN"},{"id":"792","name":"Türkei","en":"Türkiye","lat":39,"lon":35,"cap":"Ankara","cur":"TRY","flag":"🇹🇷","region":"Asia","cca2":"TR"},{"id":"795","name":"Turkmenistan","en":"Turkmenistan","lat":40,"lon":60,"cap":"Ashgabat","cur":"TMT","flag":"🇹🇲","region":"Asia","cca2":"TM"},{"id":"798","name":"Tuvalu","en":"Tuvalu","lat":-8,"lon":178,"cap":"Funafuti","cur":"AUD","flag":"🇹🇻","region":"Oceania","cca2":"TV"},{"id":"800","name":"Uganda","en":"Uganda","lat":1,"lon":32,"cap":"Kampala","cur":"UGX","flag":"🇺🇬","region":"Africa","cca2":"UG"},{"id":"804","name":"Ukraine","en":"Ukraine","lat":49,"lon":32,"cap":"Kyiv","cur":"UAH","flag":"🇺🇦","region":"Europe","cca2":"UA"},{"id":"348","name":"Ungarn","en":"Hungary","lat":47,"lon":20,"cap":"Budapest","cur":"HUF","flag":"🇭🇺","region":"Europe","cca2":"HU"},{"id":"858","name":"Uruguay","en":"Uruguay","lat":-33,"lon":-56,"cap":"Montevideo","cur":"UYU","flag":"🇺🇾","region":"Americas","cca2":"UY"},{"id":"860","name":"Usbekistan","en":"Uzbekistan","lat":41,"lon":64,"cap":"Tashkent","cur":"UZS","flag":"🇺🇿","region":"Asia","cca2":"UZ"},{"id":"548","name":"Vanuatu","en":"Vanuatu","lat":-16,"lon":167,"cap":"Port Vila","cur":"VUV","flag":"🇻🇺","region":"Oceania","cca2":"VU"},{"id":"336","name":"Vatikanstadt","en":"Vatican City","lat":41.9,"lon":12.4,"cap":"Vatican City","cur":"EUR","flag":"🇻🇦","region":"Europe","cca2":"VA"},{"id":"862","name":"Venezuela","en":"Venezuela","lat":8,"lon":-66,"cap":"Caracas","cur":"VES","flag":"🇻🇪","region":"Americas","cca2":"VE"},{"id":"784","name":"Vereinigte Arabische Emirate","en":"United Arab Emirates","lat":24,"lon":54,"cap":"Abu Dhabi","cur":"AED","flag":"🇦🇪","region":"Asia","cca2":"AE"},{"id":"840","name":"Vereinigte Staaten","en":"United States","lat":38,"lon":-97,"cap":"Washington D.C.","cur":"USD","flag":"🇺🇸","region":"Americas","cca2":"US"},{"id":"826","name":"Vereinigtes Königreich","en":"United Kingdom","lat":54,"lon":-2,"cap":"London","cur":"GBP","flag":"🇬🇧","region":"Europe","cca2":"GB"},{"id":"704","name":"Vietnam","en":"Vietnam","lat":16.2,"lon":107.8,"cap":"Hanoi","cur":"VND","flag":"🇻🇳","region":"Asia","cca2":"VN"},{"id":"140","name":"Zentralafrikanische Republik","en":"Central African Republic","lat":7,"lon":21,"cap":"Bangui","cur":"XAF","flag":"🇨🇫","region":"Africa","cca2":"CF"},{"id":"196","name":"Zypern","en":"Cyprus","lat":35,"lon":33,"cap":"Nicosia","cur":"EUR","flag":"🇨🇾","region":"Europe","cca2":"CY"}];

const byKey = new Map();
for (const c of COUNTRIES) {
  byKey.set(c.id, c);
  byKey.set(c.name.toLowerCase(), c);
}
const ALIASES = {
  "england": "826", "uk": "826", "großbritannien": "826", "vereinigtes königreich": "826",
  "amerika": "840", "usa": "840", "vereinigte staaten": "840", "us": "840",
  "korea": "410", "südkorea": "410", "nordkorea": "408", "holland": "528",
  "türkei": "792", "türkiye": "792", "tschechien": "203", "russland": "643",
};

export function findCountry(key) {
  const k = String(key || "").trim().toLowerCase();
  if (byKey.has(k)) return byKey.get(k);
  if (ALIASES[k]) return byKey.get(ALIASES[k]);
  return COUNTRIES.find((c) => k.length >= 3 && c.name.toLowerCase().startsWith(k))
      || COUNTRIES.find((c) => k.length >= 4 && c.name.toLowerCase().includes(k));
}

// --- Nachrichten holen (20 Minuten zwischengespeichert) ---
const CACHE_MS = 20 * 60 * 1000;
const newsCache = new Map(); // id -> { at, items }
const summaryCache = new Map(); // id -> { at, newsAt, bewertung, zusammenfassung }

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .trim();

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = (tag) => decode(m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const full = get("title");
    const source = get("source");
    const title = source && full.endsWith(` - ${source}`) ? full.slice(0, -source.length - 3) : full;
    const link = get("link");
    items.push({ title, source, link: /^https:\/\//.test(link) ? link : "", date: new Date(get("pubDate")).toISOString() });
  }
  return items;
}

export async function getCountryNews(country) {
  const cached = newsCache.get(country.id);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(country.name)}+when:1d&hl=de&gl=DE&ceid=DE:de`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 F.R.Ai.D.A.Y" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google News antwortet mit ${res.status}`);
  const items = parseRss(await res.text());
  const entry = { at: Date.now(), items };
  newsCache.set(country.id, entry);
  return entry;
}

// --- Hintergrund-Scanner: füllt nach und nach die Nachrichtenlage aller Länder ---
let scanning = false;
let lastScanDone = 0;
async function scanWorld() {
  if (scanning) return;
  scanning = true;
  try {
    for (let i = 0; i < COUNTRIES.length; i += 8) {
      const group = COUNTRIES.slice(i, i + 8);
      await Promise.all(group.map((c) => getCountryNews(c).catch(() => null)));
      await new Promise((r) => setTimeout(r, 400));
    }
    lastScanDone = Date.now();
  } finally {
    scanning = false;
  }
}

// Übersicht für die Weltkarte: aus dem Zwischenspeicher, plus Anstoß zum Nachladen.
export function getOverview() {
  const stale = Date.now() - lastScanDone > CACHE_MS;
  if (stale && !scanning) scanWorld();
  const list = COUNTRIES.map((c) => {
    const n = newsCache.get(c.id);
    const s = summaryCache.get(c.id);
    return { ...c, meldungen: n?.items.length ?? 0, top: n?.items[0]?.title ?? "", bewertung: s?.bewertung ?? null, geladen: Boolean(n) };
  });
  const geladen = list.filter((c) => c.geladen).length;
  return { stand: lastScanDone ? new Date(lastScanDone).toISOString() : null, scannt: scanning, geladen, gesamt: COUNTRIES.length, laender: list };
}

// --- Erdbeben (USGS, öffentlich, kein Schlüssel) ---
let quakeCache = null;
export async function getQuakes() {
  if (quakeCache && Date.now() - quakeCache.at < 10 * 60 * 1000) return quakeCache.list;
  const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson", { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  const list = (data.features || [])
    .filter((f) => f.geometry?.coordinates?.length >= 2)
    .map((f) => ({ ort: f.properties.place || "", staerke: f.properties.mag, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], zeit: new Date(f.properties.time).toISOString() }))
    .sort((a, b) => b.staerke - a.staerke)
    .slice(0, 60);
  quakeCache = { at: Date.now(), list };
  return list;
}

// --- Echte Nachrichtenbilder (GDELT, öffentlich, kein Schlüssel) ---
// GDELT erlaubt nur ca. eine Anfrage alle 5 Sekunden -> globale Warteschlange + Zwischenspeicher.
const newsImgCache = new Map(); // id -> { at, bilder }
let gdeltQueue = Promise.resolve();
let lastGdelt = 0;

function queueGdelt(fn) {
  const run = gdeltQueue.then(async () => {
    const wait = 5200 - (Date.now() - lastGdelt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGdelt = Date.now();
    return fn();
  });
  gdeltQueue = run.catch(() => {});
  return run;
}

export async function getNewsImages(country) {
  const cached = newsImgCache.get(country.id);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.bilder;
  const bilder = await queueGdelt(async () => {
    const q = encodeURIComponent(country.name);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=18&sort=datedesc`;
    const res = await fetch(url, { headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`GDELT ${res.status}`);
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { return []; }
    return (data.articles || [])
      .filter((a) => a.socialimage)
      .map((a) => ({ bild: a.socialimage, titel: a.title || "", quelle: a.domain || "", seite: a.url || "", zeit: a.seendate || "" }))
      .slice(0, 12);
  }).catch(() => []);
  newsImgCache.set(country.id, { at: Date.now(), bilder });
  return bilder;
}

// --- Bilder und öffentliche Kameras pro Land (alles frei zugänglich) ---
const mediaCache = new Map(); // id -> { at, fotos }

async function fetchFotos(country) {
  try {
    const q = encodeURIComponent((country.en || country.name) + " landmark city");
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=9&mature=false&license_type=all`, {
      headers: { "User-Agent": "F.R.Ai.D.A.Y/1.0" }, signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      bild: r.thumbnail || r.url,
      quelle: r.source || r.provider || "",
      autor: r.creator || "",
      seite: r.foreign_landing_url || r.url || "",
      titel: r.title || country.name,
    })).filter((f) => f.bild).slice(0, 9);
  } catch { return []; }
}

export async function getMedia(country) {
  const cached = mediaCache.get(country.id);
  // Bilder und Video parallel holen, damit es schnell geht.
  const [fotos, videoId] = await Promise.all([
    cached && Date.now() - cached.at < 6 * 60 * 60 * 1000 ? cached.fotos : fetchFotos(country),
    getVideoId(country),
  ]);
  mediaCache.set(country.id, { at: Date.now(), fotos });
  return withLinks(country, fotos, videoId);
}

// Erstes passendes (Live-)Video von YouTube suchen – serverseitig, ohne Schlüssel.
const videoCache = new Map();
async function getVideoId(country) {
  const cached = videoCache.get(country.id);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.id;
  let id = null;
  try {
    const q = encodeURIComponent((country.en || country.name) + " news live");
    // sp=EgJAAQ%3D%3D = Filter "Live"
    const url = `https://www.youtube.com/results?search_query=${q}&sp=EgJAAQ%253D%253D`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept-Language": "de,en" }, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const html = await res.text();
      id = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1] || null;
    }
  } catch { /* Video optional */ }
  videoCache.set(country.id, { at: Date.now(), id });
  return id;
}

function withLinks(country, fotos, videoId) {
  const { lat, lon, name } = country;
  return {
    fotos,
    video: videoId || null,
    // Öffentliche Live-Kameras und Videos: Links auf frei zugängliche Dienste.
    kameras: `https://www.windy.com/-Webcams/webcams?${lat},${lon},6`,
    videos: `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " live cam")}`,
    nachrichten_videos: `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " nachrichten heute")}`,
  };
}

// --- Länder-Infos (eingebaute Daten + Bevölkerung/Luft, alles kostenlos) ---
export async function getCountryInfo(country) {
  const [pop, luft] = await Promise.all([
    getPopulation(country.cca2).catch(() => null),
    getAirQuality(country.lat, country.lon).catch(() => null),
  ]);
  return {
    name: country.name, flagge: country.flag || "", hauptstadt: country.cap || "",
    region: country.region || "", waehrung: country.cur || "",
    einwohner: pop, luft,
  };
}

// --- Fridays Einschätzung ---
const RATING_TOOL = {
  name: "lagebericht",
  description: "Gibt die Einschätzung der Lage in einem Land zurück.",
  input_schema: {
    type: "object",
    properties: {
      bewertung: { type: "string", enum: ["gut", "schlecht", "gemischt"], description: "Grundstimmung der Nachrichtenlage" },
      zusammenfassung: { type: "string", description: "Zwei bis vier Sätze auf Deutsch, nur gestützt auf die Meldungen." },
    },
    required: ["bewertung", "zusammenfassung"],
  },
};

export async function getSummary(country) {
  const news = await getCountryNews(country);
  const cached = summaryCache.get(country.id);
  if (cached && cached.newsAt === news.at) return cached;
  if (!news.items.length) return { bewertung: "gemischt", zusammenfassung: `Zu ${country.name} gibt es in den letzten 24 Stunden keine Meldungen.` };

  const headlines = news.items.slice(0, 25).map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join("\n");
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1500,
    tool_choice: { type: "tool", name: "lagebericht" },
    tools: [RATING_TOOL],
    system: "Du bist F.R.Ai.D.A.Y und erstellst kurze Lageberichte. Stütze dich ausschließlich auf die gelieferten Schlagzeilen, erfinde nichts dazu. Sachlich, ohne Markdown.",
    messages: [{ role: "user", content: `Schlagzeilen der letzten 24 Stunden zu ${country.name}:\n${headlines}\n\nWie ist die Lage?` }],
  });
  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool) throw new Error("Keine Einschätzung erhalten");
  const result = {
    bewertung: ["gut", "schlecht", "gemischt"].includes(tool.input.bewertung) ? tool.input.bewertung : "gemischt",
    zusammenfassung: String(tool.input.zusammenfassung || "").slice(0, 1500),
  };
  summaryCache.set(country.id, { ...result, at: Date.now(), newsAt: news.at });
  return result;
}

export function friendlyError(err) {
  const msg = String(err?.message || err);
  if (/credit balance/i.test(msg)) return "Dein Claude-Guthaben ist leer. Lade es auf console.anthropic.com auf, dann bekommst du hier Fridays Einschätzung.";
  return "Die Einschätzung hat gerade nicht geklappt.";
}
