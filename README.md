ztakio-lib:
=====

A quick and easy library to connect and interact with a ztakio-server.

Usage:

```javascript
const ztaklib = require('ztakio-lib')
const wif = 'YOUR WIF'

ztaklib.connect('ws://localhost:3041', async () => {
  ztaklib.watch('.*', console.log) // To watch all changes
  await ztaklib.get('/_/mempool') // Get the mempool state
  await ztaklib.get('/ztak/coin/ZfEfwe...') // Get a balance for a token

  let code = await ztaklib.template('nft_send', { // Get a template to send an NFT
    path: '/ztak/nft',
    name: 'test1',
    destination: 'ZaswWd....'
  })
  let compiled = ztaklib.compile(code) // Compile your template
  let envelope = ztaklib.envelope(compiled, wif) // Sign and envelope

  try {
    let result = await ztaklib.tx(envelope) // Send your transaction
    console.log(result)
  } catch(e) {
    console.log(e)
  }
})
```
