// Nachgebauter Ollama-Server für Tests
const http = require('http'); let n = 0;
http.createServer((q, s) => {
  let b = ''; q.on('data', d => b += d); q.on('end', () => {
    s.setHeader('Content-Type', 'application/json');
    if (q.url === '/api/tags') return s.end(JSON.stringify({ models: [{ name: 'llama3:8b' }, { name: 'gemma3:4b' }] }));
    if (q.url === '/api/chat') {
      const j = JSON.parse(b), m = j.messages[0], imgs = (m.images || []).length; n++;
      console.log('chat model=' + j.model + ' images=' + imgs + ' format=' + j.format + ' prompt=' + m.content.slice(0, 60).replace(/\n/g, ' '));
      let out;
      if (/"names"/.test(m.content)) out = { names: ['Glutklinge Akuma', 'Feuerfürst Raiko', 'Aschezahn Kurou'], reason: 'Dämonischer Samurai mit Flammenschwert' };
      else if (/"cards"/.test(m.content)) { const k = (m.content.match(/bekommst (\d+)/) || [])[1] | 0; out = { cards: Array.from({ length: k }, (_, i) => ({ name: 'Ollamaheld ' + (i + 1), element: 'blitz', element2: i === 0 ? 'wasser' : null, race: 'mensch', race2: null, class1: 'samurai', class2: null, reason: 'Testmotiv ' + i })) }; }
      else if (/"motiv"/.test(m.content)) out = { motiv: imgs ? 'Gehörnter Samurai mit Flammenschwert' : '' };
      else out = { ok: true, name: 'Testname Ollama' };
      return s.end(JSON.stringify({ message: { role: 'assistant', content: JSON.stringify(out) } }));
    }
    s.statusCode = 404; s.end('{}');
  });
}).listen(11434, () => console.log('fake ollama bereit'));
