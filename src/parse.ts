import * as fs from 'fs'
import { join } from 'path'
import { Station, Stop, Train } from './types'
const csv = require('csv-parser')

const path = (p: string) => join(__dirname, p)

function parseCsv<T>(path: string, headers: string[]): Promise<T[]> {
  const results: T[] = []

  return new Promise(resolve => {
    fs.createReadStream(path)
      .pipe(
        csv({
          headers
        })
      )
      .on('data', (data: any) => results.push(data))
      .on('end', () => {
        resolve(results)
      })
  })
}

export async function parseData(): Promise<{
  trains: Train[]
  stations: Station[]
  stops: Stop[]
}> {
  const trains = await parseCsv<Train>(path('trains.csv'), [
    'id',
    'headsign',
    'name',
    'date',
    'created_at',
    'updated_at',
    'line_id'
  ])
  const stops = await parseCsv<Stop>(path('stops.csv'), [
    'id',
    'train_id',
    'station_id',
    'departure',
    'arrival',
    'created_at',
    'updated_at'
  ])
  const stations = await parseCsv<Station>(path('stations.csv'), [
    'id',
    'name',
    'display_name',
    'lon',
    'lat',
    'available',
    'created_at',
    'updated_at'
  ])

  return { trains, stations, stops }
}
