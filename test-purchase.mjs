import { parsePurchaseText } from './js/purchase-parser.js';
import { snapPurchaseRecords, buildCartQueue } from './js/purchase-snap.js';

const SAMPLE = `散光日抛	－3.25,75,180（2盒）
散光日抛	-3.50,225,180（2盒）
散光日抛	-6.50，125，180（2盒）
散光日抛	-7.00，175，180（2盒）
舒日散光日抛	－6.50，175，180（3盒）
散光双周	－6.50，175，170（1盒）
散光双周	－2.00，175，10（1盒）`;

const records = parsePurchaseText(SAMPLE);
console.log('Parsed:', records.length, 'records');
records.forEach((r) =>
  console.log(`  ${r.productName || '?'} ${r.sphere}/${r.cylinder}×${r.axis} ${r.qty}盒 → ${r.productId}`)
);

const snapped = snapPurchaseRecords(records);
const invalid = snapped.filter((s) => !s.valid);
const queue = buildCartQueue(snapped);

console.log('\nSnapped:');
snapped.forEach((s) => {
  if (!s.valid) console.log('  INVALID:', s.error);
  else if (s.changed) console.log('  adjusted:', s.adjustments.join('; '));
});

console.log('\nCart queue items:', queue.items.length);
queue.items.forEach((item, i) =>
  console.log(`  ${i + 1}. [${item.productName}] ${item.pwr}/${item.cy}×${item.ax} ×${item.qty}`)
);

if (invalid.length) {
  console.error('\nFAIL: invalid records');
  process.exit(1);
}
console.log('\nOK');
