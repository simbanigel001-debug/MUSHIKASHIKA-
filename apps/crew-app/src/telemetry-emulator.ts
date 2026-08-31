// apps/crew-app/src/telemetry-emulator.ts

export interface GeoPoint {
  lat: number;
  lng: number;
  speed: number;
}

// Predefined Bulawayo route waypoints (Ascot Precinct -> CBD -> Luveve corridor)
const ROUTE_WAYPOINTS: GeoPoint[] = [
  { lat: -20.1585, lng: 28.6028, speed: 0 },   // Ascot Precinct / Shopping Centre (Stopped)
  { lat: -20.1540, lng: 28.5910, speed: 40 },  // Along 12th Avenue Extension
  { lat: -20.1500, lng: 28.5830, speed: 30 },  // Entering Bulawayo CBD (Leopold Takawira Ave)
  { lat: -20.1475, lng: 28.5750, speed: 0 },   // Ekuphumuleni / Main CBD Rank (Stopped for pickups)
  { lat: -20.1380, lng: 28.5600, speed: 50 },  // Luveve Road (Cruising past Thorngrove)
  { lat: -20.1250, lng: 28.5350, speed: 55 },  // Luveve Road (Heading west)
  { lat: -20.1120, lng: 28.5100, speed: 0 }    // Luveve Rank (Final Stop)
];

export class TelemetryEmulator {
  private static timer: NodeJS.Timeout | null = null;
  private static currentIndex = 0;

  static startSimulation(shiftId: string, onPointGenerated: (point: object) => void) {
    if (this.timer) return; // Prevent duplicate loops

    this.timer = setInterval(() => {
      const current = ROUTE_WAYPOINTS[this.currentIndex];
      
      const payload = {
        shiftId,
        lat: current.lat,
        lng: current.lng,
        speed: current.speed > 0 ? current.speed + Math.floor(Math.random() * 5 - 2) : 0, // Natural speed variation
        timestamp: new Date().toISOString()
      };

      onPointGenerated(payload);

      // Advance route index across Bulawayo waypoints
      this.currentIndex = (this.currentIndex + 1) % ROUTE_WAYPOINTS.length;
    }, 3000); // Broadcast every 3 seconds

    console.log(`📡 GPS Telemetry Emulator (Bulawayo Route) started for shift: ${shiftId}`);
  }

  static stopSimulation() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 GPS Telemetry Emulator stopped.');
    }
  }
}
