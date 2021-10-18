import { makeBlock, Port, Resistor, DCVoltage, Ohms, MOSFET, Volts, Simulate, ACVoltage, Transient, watchParameters, Nanoseconds, Capacitor, Farads, Microseconds, OperatingPoint, Hertz, Seconds, CircuitComponent, AsString, ExpandOnce } from "./index.ts"
import { plot } from "https://deno.land/x/chart/mod.ts";

const VoltageDivider = (ratio: number) => makeBlock({
    in: Port,
    out: Port,
    R1: Resistor({ resistance: Ohms((1e3 - ratio*1e3)/ratio)}),
    R2: Resistor({ resistance: Ohms(1e3)}),
}).connect((_) => [
    _.in.to.R1.left,
          _.R1.left.to.out,
          _.R1.right.to.R2.left,
                      _.R2.right.to.Ground,
]);

const Circuit = makeBlock({
    V: ACVoltage({amplitude: Volts(5), offset: Volts(0), freq: Hertz(2e9)}),
    D: VoltageDivider(0.5),
    out: Port
}).connect((_) => [
    _.V.pos.to.D.in,
             _.D.out.to.out,
    _.V.neg.to.Ground
]);

/*
const result = await Simulate(
    Circuit,
    Transient({
        step: Seconds(0.05e-9),
        stop: Seconds(2e-9)
    }));

console.log(result.rawfile)
console.log(plot(result.circuit.V.pos))
console.log(plot(normalize(result.circuit.D.R1.p)))
*/

function normalize(n: number[], mag?: number) {
    const max = Math.max(...n.map(Math.abs));
    return n.map((el) => (mag ?? 1)*el/max);
}

//console.log(result.data)

const FETCircuit = makeBlock({
    V: DCVoltage({voltage: Volts(5)}),
    AC: ACVoltage({offset: Volts(0), amplitude: Volts(5), freq: Hertz(2e9)}),
    T: MOSFET({})
}).connect((_) => [
    _.V.pos.to.T.source,
   _.AC.pos.to.T.gate,
             _.T.drain.to.Ground,
             _.T.base.to.Ground,
   _.AC.neg.to.Ground,
    _.V.neg.to.Ground
])

const result = await Simulate(
    FETCircuit,
    Transient({
        step: Seconds(0.05e-9),
        stop: Seconds(2e-9)
    }));

console.log(result.rawfile)
console.log(plot(result.circuit.T.gate));
console.log(plot(normalize(result.circuit.T.id, 10)));


/*
const RCCircuit = makeBlock({
    V: DCVoltage({voltage: Volts(5)}),
    R: Resistor({resistance: Ohms(1)}),
    C: Capacitor({capacitance: Farads(1e-6)})
}).connect((_) => [
    _.V.pos.to.R.left,
             _.R.right.to.C.left,
                        _.C.right.to.Ground,
    _.V.neg.to.Ground
])
*/

//const rcresolve = await Simulate(RCCircuit, Transient({ step: Microseconds(1), stop: Microseconds(10) }))
//console.log(rcresolve.spice)
//console.log(rcresolve.rawfile)


//console.log(RCCircuit);