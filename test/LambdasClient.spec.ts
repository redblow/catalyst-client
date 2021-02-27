import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { mock, instance, when, anything } from 'ts-mockito'
import { Fetcher } from 'dcl-catalyst-commons'
import { LambdasClient } from 'index'

chai.use(chaiAsPromised)
const expect = chai.expect

describe('LambdasClient', () => {
  const URL = 'https://url.com'

  it('When fetching for a profile, then the result is as expected', async () => {
    const requestResult = someResult()
    const ethAddress = 'ethAddress'
    const { instance: fetcher } = mockFetcherJson(`/profile/${ethAddress}`, requestResult)

    const client = buildClient(URL, fetcher)
    const result = await client.fetchProfile(ethAddress)

    expect(result).to.deep.equal(requestResult)
  })

  it('When fetching for many profiles, then the result is as expected', async () => {
    const requestResult = [someResult()]
    const [ethAddress1, ethAddress2] = ['ethAddress1', 'ethAddress2']
    const { instance: fetcher } = mockFetcherJson(`/profiles?id=${ethAddress1}&id=${ethAddress2}`, requestResult)

    const client = buildClient(URL, fetcher)
    const result = await client.fetchProfiles([ethAddress1, ethAddress2])

    expect(result).to.deep.equal(requestResult)
  })

  it('When fetching for wearables, then the result is as expected', async () => {
    const wearables = [{ id: 'wearableId' }]
    const requestResult = {
      wearables,
      pagination: { offset: 0, limit: 0, moreData: false }
    }
    const { instance: fetcher } = mockFetcherJson(
      `/collections/wearables?textSearch=text&wearableId=id1&wearableId=id2&offset=0`,
      requestResult
    )

    const client = buildClient(URL, fetcher)
    const result = await client.fetchWearables({ wearableIds: ['id1', 'id2'], textSearch: 'text' })

    expect(result).to.deep.equal(wearables)
  })

  it('When fetching for owned wearables without definition, then the result is as expected', async () => {
    const ethAddress = 'ethAddress'
    const requestResult = [{ urn: 'urn', amount: 10 }]
    const { instance: fetcher } = mockFetcherJson(
      `/collections/wearables-by-owner/${ethAddress}?includeDefinitions=false`,
      requestResult
    )

    const client = buildClient(URL, fetcher)
    const result = await client.fetchOwnedWearables(ethAddress, false)

    expect(result).to.deep.equal(requestResult)
  })

  it('When fetching for owned wearables with definition, then the result is as expected', async () => {
    const ethAddress = 'ethAddress'
    const requestResult = [{ urn: 'urn', amount: 10, definition: {} }]
    const { instance: fetcher } = mockFetcherJson(
      `/collections/wearables-by-owner/${ethAddress}?includeDefinitions=true`,
      requestResult
    )

    const client = buildClient(URL, fetcher)
    const result = await client.fetchOwnedWearables(ethAddress, true)

    expect(result).to.deep.equal(requestResult)
  })

  function someResult() {
    return {
      someKey: 'someValue'
    }
  }

  function mockFetcherJson<T>(path?: string, result?: T): { mock: Fetcher; instance: Fetcher } {
    // Create mock
    const mockedFetcher: Fetcher = mock(Fetcher)

    if (path) {
      when(mockedFetcher.fetchJson(anything(), anything())).thenCall((url, _) => {
        expect(url).to.equal(`${URL}${path}`)
        return Promise.resolve(result)
      })
    }

    // Getting instance from mock
    return { mock: mockedFetcher, instance: instance(mockedFetcher) }
  }

  function buildClient(URL: string, fetcher: Fetcher) {
    return new LambdasClient(URL, fetcher)
  }
})
