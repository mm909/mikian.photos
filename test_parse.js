const fs = require('fs');
const html = fs.readFileSync('musser_test.html', 'utf8');

const rowRe = /<li class="[^"]*list-group-item row">([\s\S]*?)(?=<li class="[^"]*list-group-item|<\/ul>)/g;
let m, c = 0;
while ((m = rowRe.exec(html)) !== null) {
  c++;
  const row = m[1];
  const h = row.includes('list-group-header');
  const n = row.match(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/);
  const ev = m[0].match(/event-([A-Za-z0-9_]+)/);
  const bib = row.match(/Bib no\.<\/div>(\d+)<\/div>/);
  const wave = row.match(/Startwave<\/div>([^<]+)<\/div>/);
  console.log(`Row ${c}: header=${h}, name=${n?.[2]}, event=${ev?.[1]}, bib=${bib?.[1]}, wave=${wave?.[1]}`);
}
console.log('Total rows:', c);
