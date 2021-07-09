// Code copied from https://github.com/decentraland/pow-authorization-server
import { createHash, randomBytes } from 'crypto'

export async function generateNonceForChallenge(challenge, complexity): Promise<string> {
  while (true) {
    const nonce = randomBytes(256).toString('hex')
    const a = challenge + nonce
    const hash = await createHash('sha256').update(a, 'hex').digest('hex')

    const isValid = hash.startsWith('0'.repeat(complexity))

    if (isValid) {
      return nonce
    }
  }
}
