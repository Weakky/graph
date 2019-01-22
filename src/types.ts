export interface Train {
  id: string
  headsign: string
  name: string
  date: string
  line_id: string
}

export interface Stop {
  id: string
  train_id: string
  station_id: string
  departure: string
  arrival: string
}

export interface Station {
  id: string
  name: string
  display_name: string
  lon: string
  lat: string
  available: string
}

export interface Node {
  station: Station
  edges: Edge[]
}

export interface Edge {
  nextNode: Node
  weight: number
  trainId: string
}

export interface GraphMap {
  [stopId: string]: TrainTravel
}

// interface Travel {
//   trainId: string
//   weight: number
//   node: Node
// }

/**
 * @output An edge per train between stations
 * (a:Station)-[:TRAVEL { :weight, :train_id=1 }]->(b:Station)
 * (a:Station)-[:TRAVEL { :weight, :train_id=2 }]->(b:Station)
 * (a:Station)-[:TRAVEL { :weight, :train_id=3 }]->(b:Station)
 * (a:Station)-[:TRAVEL { :weight, :train_id=4 }]->(b:Station)
 * (a:Station)-[:TRAVEL { :weight, :train_id=5 }]->(b:Station)
 */

/**
 * Trajet d'un train via ses arrêts ()
 */
export interface TrainTravel {
  train: Train
  stops: (Stop & { weight: number })[] // Du départ au terminus (s1)->(s2)->(s3)->(s4)->(...)
}

export interface Travel {
  from: Station
  to: Station | undefined
  weight: number
  train_id: string
}
