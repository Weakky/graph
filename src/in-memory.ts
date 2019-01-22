import * as moment from 'moment'
import { parseData } from './parse'
import { Node, Station, Stop, Train } from './types'

main()

async function main() {
  const { trains, stations, stops } = await parseData()

  const departureSearch = 'Nancy-Ville'
  const destinationSearch = 'Luxembourg'

  const nodes = buildGraph({
    trains,
    stops,
    stations
  })

  const result = search(departureSearch, destinationSearch, nodes)

  console.log({ result: result.map(node => node.station.name) })
}

function buildGraph(data: {
  trains: Train[]
  stops: Stop[]
  stations: Station[]
}): Node[] {
  const { trains, stops, stations } = data

  let nodes: Node[] = stations.map(
    station =>
      ({
        station,
        edges: []
      } as Node)
  )

  trains.forEach(train => {
    /**
     * Stops of a train sorted by departure to arrival
     * The added @weight of each stop is the time to go from that stop to the next one
     */
    const trainStops = stops
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

    /** We then set each of the stops as edges of each stations  */
    trainStops.forEach((stop, index) => {
      const nodeIndex = nodes.findIndex(
        node => node.station.id === stop.station_id
      )

      if (nodeIndex === -1) {
        throw new Error('No station associated to stop')
      }

      const nodeStation = nodes[nodeIndex]

      if (index + 1 < trainStops.length) {
        const nextNodeStation = nodes.find(
          node => node.station.id === trainStops[index + 1].station_id
        )

        if (nextNodeStation === undefined) {
          throw new Error('Should not happen')
        }

        nodeStation.edges.push({
          trainId: train.id,
          weight: stop.weight,
          nextNode: nextNodeStation
        })

        nodes[nodeIndex] = nodeStation
      }
    })
  })

  return nodes
}

function reconstructPath(cameFrom: Record<string, Node>, current: Node) {
  const finalPath: Node[] = [current]

  while (Object.keys(cameFrom).includes(current.station.id)) {
    current = cameFrom[current.station.id]
    finalPath.push(current)
  }

  return finalPath.reverse()
}

function search(departure: string, destination: string, nodes: Node[]): Node[] {
  const startNode = nodes.find(node => node.station.name === departure)
  const endNode = nodes.find(node => node.station.name === destination)

  if (startNode === undefined || endNode === undefined) {
    throw new Error('Could not find start or end')
  }

  const closedSet: Node[] = []
  let openSet: Node[] = [startNode]
  const cameFrom: Record<string, Node> = {}
  const gScore = nodes.reduce<Record<string, number>>((acc, node) => {
    return {
      ...acc,
      [node.station.id]: Infinity
    }
  }, {})
  const fScore = gScore

  gScore[startNode.station.id] = 0
  fScore[startNode.station.id] = heuristic(startNode, endNode)

  while (openSet.length > 0) {
    const current = openSet
      .sort((a, b) => {
        return fScore[a.station.id] - fScore[b.station.id]
      })
      .shift()!

    openSet = openSet.filter(node => node.station.id !== current!.station.id)

    if (current.station.id === endNode.station.id) {
      return reconstructPath(cameFrom, current)
    }

    closedSet.push(current)

    current.edges.forEach(edge => {
      const neighbor = edge.nextNode

      if (!closedSet.find(node => node.station.id === neighbor.station.id)) {
        const tmpGScore =
          gScore[current!.station.id] + heuristic(current!, neighbor)

        if (!openSet.find(node => node.station.id === neighbor.station.id)) {
          openSet.push(neighbor)
        } else if (tmpGScore >= gScore[neighbor.station.id]) {
          return
        }

        cameFrom[neighbor.station.id] = current!
        gScore[neighbor.station.id] = tmpGScore
        fScore[neighbor.station.id] = tmpGScore + heuristic(neighbor, endNode)
      }
    })
  }

  return []
}

function heuristic(a: Node, b: Node) {
  const lat1 = parseFloat(a.station.lat)
  const lat2 = parseFloat(b.station.lat)
  const long1 = parseFloat(a.station.lon)
  const long2 = parseFloat(b.station.lon)

  return distance(lat1, long1, lat2, long2, 'K')
}

function distance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'M' | 'K' | 'N'
) {
  if (lat1 == lat2 && lon1 == lon2) {
    return 0
  } else {
    var radlat1 = (Math.PI * lat1) / 180
    var radlat2 = (Math.PI * lat2) / 180
    var theta = lon1 - lon2
    var radtheta = (Math.PI * theta) / 180
    var dist =
      Math.sin(radlat1) * Math.sin(radlat2) +
      Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta)
    if (dist > 1) {
      dist = 1
    }
    dist = Math.acos(dist)
    dist = (dist * 180) / Math.PI
    dist = dist * 60 * 1.1515
    if (unit == 'K') {
      dist = dist * 1.609344
    }
    if (unit == 'N') {
      dist = dist * 0.8684
    }
    return dist
  }
}
