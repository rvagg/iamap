import { Store } from '../interface'

export interface TestStore extends Store<number> {
  map: Map<number, any>,
  saves: number,
  loads: number
  /** Force the next load/save operation to get stuck and wait for signal.abort() */
  getStuck(): void
}
