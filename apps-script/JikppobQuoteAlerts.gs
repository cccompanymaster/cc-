// The bound script sends only receipt IDs to the company's operations inbox.
function prepareJikppobAlerts() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('JIK_QUOTE_READER');
  if (!token) {
    token = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('JIK_QUOTE_READER', token);
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  console.log('Verifier SHA256 ' + digest.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join(''));
}

function deliverJikppobAlerts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('JIK_QUOTE_READER');
    if (!token) throw new Error('Quote reader is not configured');
    function batch(ack) {
      const res = UrlFetchApp.fetch('https://xn--y43bx4q.kr/api/quote-alerts', {
        method: 'post', contentType: 'application/json', followRedirects: false,
        headers: {Authorization: 'Bearer ' + token}, payload: JSON.stringify({ack: ack}), muteHttpExceptions: true
      });
      if (res.getResponseCode() !== 200) throw new Error('Quote alert lookup HTTP ' + res.getResponseCode());
      const ids = JSON.parse(res.getContentText());
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id))) throw new Error('Invalid receipts');
      return ids;
    }
    const pendingAck = JSON.parse(props.getProperty('JIK_QUOTE_ACK') || '[]');
    const ids = batch(pendingAck);
    props.deleteProperty('JIK_QUOTE_ACK');
    if (!ids.length) return;
    const codes = ids.map(id => 'JB-' + id).join(', ');
    MailApp.sendEmail('cccompanymaster@gmail.com', '[직뽑] 새 견적 상담 ' + ids.length + '건 · JB-' + ids[ids.length - 1],
      '접수번호 ' + codes + '\n\n직뽑 관리자에서 상담 내용을 확인해 주세요.\nhttps://xn--y43bx4q.kr/admin/#/requests');
    props.setProperty('JIK_QUOTE_ACK', JSON.stringify(ids));
    batch(ids);
    props.deleteProperty('JIK_QUOTE_ACK');
  } finally { lock.releaseLock(); }
}

function jikQuoteWake_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 220) return jsonResponse_({ok:false});
  let reader;
  try { reader = JSON.parse(raw).dispatch; } catch (_) { return jsonResponse_({ok:false}); }
  if (typeof reader !== 'string' || reader.length !== 72) return jsonResponse_({ok:false});
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,reader)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
  if (hash !== '8414728c5afefd3feb4bc0a457f6ebd2465894bb26a288c5e91518aeb11164f3') return jsonResponse_({ok:false});
  deliverJikppobAlerts();
  return jsonResponse_({ok:true});
}
