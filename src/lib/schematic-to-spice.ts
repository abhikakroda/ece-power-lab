/**
 * schematic-to-spice.ts
 * Utility to convert the visual schematic nodes and components into a standard SPICE netlist.
 */

export interface SchematicNode {
  id: string;
  x: number;
  y: number;
  netId: string; // The electrical node ID (e.g., '0' for ground, '1', '2' for others)
}

export interface SchematicComponent {
  id: string; // Internal unique ID
  type: "R" | "C" | "L" | "V" | "I" | "D" | "Q" | "M" | "GND";
  name: string; // Display name like R1, Vbat
  value: string; // Component value (e.g. '1k', '10', '1u')
  nodes: string[]; // Connected node IDs
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
}

export function buildNetlist(components: SchematicComponent[], pins: { [componentId: string]: { [pinName: string]: string } }): string {
  let netlist = "";
  
  // Exclude GND components themselves, but ensure their connected nets become '0'
  const activeComponents = components.filter(c => c.type !== "GND");

  for (const c of activeComponents) {
    const componentPins = pins[c.id] || {};
    
    // Default node fallback for disconnected pins
    let n1 = componentPins["1"] || "NC_1_" + c.id;
    let n2 = componentPins["2"] || "NC_2_" + c.id;
    let n3 = componentPins["3"]; // For transistors
    let n4 = componentPins["4"]; // For MOSFET body usually

    switch (c.type) {
      case "R":
      case "C":
      case "L":
      case "V":
      case "I":
      case "D":
        netlist += `${c.name} ${n1} ${n2} ${c.value}\n`;
        break;
      case "Q": // BJT: C B E
        netlist += `${c.name} ${n1} ${n2} ${n3} ${c.value}\n`;
        break;
      case "M": // MOSFET: D G S (Body tied to Source usually in simple editors)
        netlist += `${c.name} ${n1} ${n2} ${n3} 0 ${c.value}\n`;
        break;
    }
  }

  return netlist.trim();
}
