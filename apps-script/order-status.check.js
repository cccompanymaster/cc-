// node apps-script/order-status.check.js — npOrderStatus_(Nicepay.gs)가 PAID 주문에만 금액을 내주는지 확인
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const orders = { 'NOAH-20261109120000-abcdef12': { status: 'PAID', intent: { amount: 22000 } },
                 'NOAH-20261109120000-0000beef': { status: 'READY', intent: { amount: 99000 } } };
const ctx = { jsonResponse_: (o) => o, findNicepayOrder_: (id) => orders[id] || null };
vm.createContext(ctx);
const src = fs.readFileSync(__dirname + '/Nicepay.gs', 'utf8');
vm.runInContext(src.match(/const NP_ORDER_ID_RE[^\n]*/)[0].replace('const ', 'var ') + '\n' + src.match(/function npOrderStatus_[\s\S]*?\n}/)[0], ctx);
const q = (id) => JSON.parse(vm.runInContext(`JSON.stringify(npOrderStatus_(${JSON.stringify(id)}))`, ctx));
assert.deepStrictEqual(q('NOAH-20261109120000-abcdef12'), { ok: true, paid: true, amount: 22000 });
assert.deepStrictEqual(q('NOAH-20261109120000-0000beef'), { ok: true, paid: false, amount: 0 });   // 결제 전
assert.deepStrictEqual(q('NOAH-20261109120000-ffffffff'), { ok: true, paid: false, amount: 0 });   // 없는 주문
assert.deepStrictEqual(q("x'); drop"), { ok: true, paid: false, amount: 0 });                       // 형식 아님
console.log('order-status ok');
