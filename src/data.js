// The original game's geography and points, including water/Four Corners links.
const rows = `AL|Alabama|1|FL GA MS TN
AZ|Arizona|2|CA CO NV NM UT
AR|Arkansas|1|LA MS MO OK TN TX
CA|California|1|OR NV AZ
CO|Colorado|1|AZ KS NE NM OK UT WY
CT|Connecticut|3|MA NY RI
DE|Delaware|2|MD NJ PA
FL|Florida|2|GA AL
GA|Georgia|1|FL AL TN NC SC
ID|Idaho|2|MT NV OR UT WA WY
IL|Illinois|2|IN KY MO IA WI
IN|Indiana|1|IL KY MI OH
IA|Iowa|2|IL NE MN MO SD WI
KS|Kansas|1|CO MO NE OK
KY|Kentucky|1|IL IN MO OH TN VA WV
LA|Louisiana|1|AR MS TX
ME|Maine|4|NH
MD|Maryland|1|DE PA VA WV
MA|Massachusetts|3|CT NH NY RI VT
MI|Michigan|3|WI OH IN MN
MN|Minnesota|2|IA MI ND SD WI
MS|Mississippi|1|AL AR LA TN
MO|Missouri|1|AR IL IA KS KY NE OK TN
MT|Montana|2|ID ND SD WY
NE|Nebraska|2|CO IA KS MO SD WY
NV|Nevada|1|AZ CA ID OR UT
NH|New Hampshire|3|ME MA VT
NJ|New Jersey|2|NY PA DE
NM|New Mexico|3|AZ CO OK TX UT
NY|New York|3|VT MA CT NJ PA RI
NC|North Carolina|1|GA SC TN VA
ND|North Dakota|2|MN MT SD
OH|Ohio|2|PA WV KY IN MI
OK|Oklahoma|2|AR CO KS MO NM TX
OR|Oregon|2|CA ID NV WA
PA|Pennsylvania|3|NY NJ DE MD WV OH
RI|Rhode Island|3|CT MA NY
SC|South Carolina|2|GA NC
SD|South Dakota|1|IA MN MT NE ND WY
TN|Tennessee|1|AL AR GA KY MS MO NC VA
TX|Texas|2|AR LA NM OK
UT|Utah|2|AZ CO ID NV NM WY
VT|Vermont|3|MA NH NY
VA|Virginia|1|KY MD NC TN WV
WA|Washington|3|ID OR
WV|West Virginia|1|KY MD OH PA VA
WI|Wisconsin|3|MN MI IA IL
WY|Wyoming|1|CO MT NE SD UT ID`;

export const STATES = Object.fromEntries(
  rows.split('\n').map((row) => {
    const [code, name, points, neighbors] = row.split('|');
    return [code, { code, name, points: Number(points), neighbors: neighbors.split(' ') }];
  }),
);
export const CODES = Object.keys(STATES);
export const EAST = 'ME NH MA RI CT NJ NY DE MD VA NC SC GA FL'.split(' ');
export const WEST = ['CA', 'OR', 'WA'];
export const coast = (code) => (WEST.includes(code) ? 'west' : EAST.includes(code) ? 'east' : null);
