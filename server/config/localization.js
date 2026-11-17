'use strict';

// Codes pays ISO 3166-1 alpha-2 couvrant les 54 États africains et les marchés
// européens pris en charge par les options de l'application.
const SUPPORTED_COUNTRIES = [
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ',
  'EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG',
  'MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO',
  'ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
  'AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE',
  'GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL',
  'MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','TR','UA',
  'GB','VA','GE','AM','AZ','US','CA'
];

// Devises de référence utilisées dans les documents. FCFA est conservé comme alias
// historique ; XOF et XAF identifient distinctement les deux unions monétaires CFA.
const SUPPORTED_CURRENCIES = [
  'FCFA','XOF','XAF','DZD','AOA','BWP','BIF','CVE','KMF','CDF','DJF','EGP',
  'ERN','SZL','ETB','GMD','GHS','GNF','KES','LSL','LRD','LYD','MGA','MWK',
  'MRU','MUR','MAD','MZN','NAD','NGN','RWF','STN','SCR','SLE','SOS','ZAR',
  'SSP','SDG','TZS','TND','UGX','ZMW','ZWG','EUR','GBP','CHF','ISK','NOK',
  'SEK','DKK','PLN','CZK','HUF','RON','MDL','UAH','RSD','BAM','ALL','MKD',
  'TRY','BYN','RUB','USD','CAD'
];

// Fuseaux IANA utilisés en Afrique et en Europe, ainsi que les principaux fuseaux
// nord-américains déjà proposés. La date civile est calculée par Intl côté serveur.
const SUPPORTED_TIMEZONES = [
  'Africa/Algiers','Africa/Luanda','Africa/Porto-Novo','Africa/Gaborone',
  'Africa/Bujumbura','Atlantic/Cape_Verde','Africa/Douala','Africa/Bangui',
  'Africa/Ndjamena','Indian/Comoro','Africa/Brazzaville','Africa/Kinshasa',
  'Africa/Abidjan','Africa/Djibouti','Africa/Cairo','Africa/Malabo',
  'Africa/Asmara','Africa/Mbabane','Africa/Addis_Ababa','Africa/Libreville',
  'Africa/Banjul','Africa/Accra','Africa/Conakry','Africa/Bissau',
  'Africa/Nairobi','Africa/Maseru','Africa/Monrovia','Africa/Tripoli',
  'Indian/Antananarivo','Africa/Blantyre','Africa/Bamako','Africa/Nouakchott',
  'Indian/Mauritius','Africa/Casablanca','Africa/Maputo','Africa/Windhoek',
  'Africa/Niamey','Africa/Lagos','Africa/Kigali','Africa/Sao_Tome',
  'Indian/Mahe','Africa/Dakar','Africa/Freetown','Africa/Mogadishu',
  'Africa/Johannesburg','Africa/Juba','Africa/Khartoum','Africa/Dar_es_Salaam',
  'Africa/Lome','Africa/Tunis','Africa/Kampala','Africa/Lusaka','Africa/Harare',
  'Europe/Tirane','Europe/Andorra','Europe/Vienna','Europe/Minsk',
  'Europe/Brussels','Europe/Sarajevo','Europe/Sofia','Europe/Zagreb',
  'Asia/Nicosia','Europe/Prague','Europe/Copenhagen','Europe/Tallinn',
  'Europe/Helsinki','Europe/Paris','Europe/Berlin','Europe/Athens',
  'Europe/Budapest','Atlantic/Reykjavik','Europe/Dublin','Europe/Rome',
  'Europe/Riga','Europe/Vaduz','Europe/Vilnius','Europe/Luxembourg',
  'Europe/Malta','Europe/Chisinau','Europe/Monaco','Europe/Podgorica',
  'Europe/Amsterdam','Europe/Skopje','Europe/Oslo','Europe/Warsaw',
  'Europe/Lisbon','Europe/Bucharest','Europe/Moscow','Europe/San_Marino',
  'Europe/Belgrade','Europe/Bratislava','Europe/Ljubljana','Europe/Madrid',
  'Europe/Stockholm','Europe/Zurich','Europe/Istanbul','Europe/Kyiv',
  'Europe/London','Europe/Vatican','America/New_York','America/Toronto','UTC'
];

module.exports = {
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES
};
