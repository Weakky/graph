import * as bluebird from 'bluebird'
import neo4j from 'neo4j-driver'
import { EOL } from 'os'
import { Station, Stop, Train, TrainTravel, Travel } from './types'
import moment = require('moment')
import { writeFileSync } from 'fs'
import { join } from 'path'

const stations = require('./stations.json') as Station[]
const stops = require('./stops.json') as Stop[]
const trains = require('./trains.json') as Train[]
const travels = require('./travels.json') as Travel[]

const URI = 'bolt://localhost:7687'
const USER = 'neo4j'
const PASSWORD = 'root'

main()

async function main() {
  console.time('Pushing to Neo4j ...')

  // computeTravels({ trains, stops, stations })

  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD))
  const session = driver.session()

  // 4530 nodes
  await seedStations(stations, session)

  // 3972 nodes
  await createStationsEdges(travels, session)

  session.close()
  driver.close()

  console.timeEnd('Pushing to Neo4j ...')
  //const result = search(departureSearch, destinationSearch, nodes)
}

function buildTravelQuery(
  travel: Travel
): { query: string; params: Record<string, any> } {
  return {
    query: `
MATCH (a:Station),(b:Station) WHERE a.name = $from AND b.name = $to
CREATE (a)-[:TRAVEL { trainId: $trainId, weight: $weight }]->(b)`,
    params: {
      from: travel.from.name,
      to: travel.to!.name,
      trainId: travel.train_id,
      weight: travel.weight
    }
  }
}

async function createStationsEdges(travels: Travel[], session: neo4j.Session) {
  return bluebird.map(
    travels,
    t => {
      if (!t.to) {
        return Promise.resolve({})
      }
      const { query, params } = buildTravelQuery(t)

      return session.run(query, params)
    },
    { concurrency: 10 }
  )
}

/**
 * Seed stations
 */
async function seedStations(stations: Station[], session: neo4j.Session) {
  const seedStationsQuery = stations
    .map(
      ({ id, available, display_name, lat, lon, name }, index) =>
        `CREATE (a${index}:Station {name: "${name}", id: "${id}", display_name: "${display_name}", lon: "${lon}", lat: "${lat}", available: "${available}"})`
    )
    .join(EOL)

  return session.run(seedStationsQuery)
}

function computeTravels(data: {
  trains: Train[]
  stops: Stop[]
  stations: Station[]
}): void {
  const { trains, stops, stations } = data

  /**
   * Stops of a train sorted by departure to arrival
   * The added @weight of each stop is the time to go from that stop to the next one
   */
  const trainTravels: TrainTravel[] = trains.map(train => {
    return {
      train,
      stops: stops
        .filter(stop => stop.train_id === train.id)
        .sort((a, b) => moment(a.departure).unix() - moment(b.departure).unix())
        .map((stop, index) => {
          return {
            ...stop,
            weight:
              index + 1 < stops.length
                ? moment(stops[index + 1].arrival).unix() -
                  moment(stop.departure).unix()
                : 0
          } as Stop & { weight: number }
        })
    }
  })

  // 1 -> 2 -> 3

  const allTravels = [] as Travel[]

  trainTravels.forEach(travel => {
    travel.stops.forEach((stop, i) => {
      const from = stations.find(s => s.id === stop.station_id)!
      const to =
        i + 1 < travel.stops.length
          ? stations.find(s => s.id === travel.stops[i + 1].id)
          : undefined

      allTravels.push({
        from,
        to,
        weight: stop.weight,
        train_id: travel.train.id
      })
    })
  })

  writeFileSync(
    join(__dirname, 'travels.json'),
    JSON.stringify(allTravels, null, 2).toString()
  )
  console.log('Travels written at ./src/travels.json')
  process.exit(0)
}
