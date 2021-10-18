import { assert, assertNotEquals } from "https://deno.land/std@0.111.0/testing/asserts.ts";
import { plot } from "https://deno.land/x/chart/mod.ts";
import { Simulate, OperatingPoint, DCVoltage, makeBlock, Volts, DCCurrent, Amps, Resistor, Ohms, Port } from "./index.ts";
import { CommonSourceAmplifier, DifferentialPair, DoubleNMosCurrentMirror, NMos, OpAmp, PMos, PMosCurrentMirror } from "./opamp.ts"

function assertClose(A: number, B: number) {
    assert(Math.abs((A - B)/A) < 0.001);
}

function assertGreaterThan(A: number, B: number) {
    assert(A > B);
}


Deno.test("NMos is an NMos", async () => {
    let Circuit = makeBlock({
        V: DCVoltage({voltage: Volts(5)}),
        T: NMos({})
    }).connect((_) => [
        _.V.pos.to.T.drain,
        _.V.pos.to.T.gate, // Gate is connected to V
                 _.T.source.to.Ground,
                 _.T.base.to.Ground,
        _.V.neg.to.Ground
    ]);

    const simOn = await Simulate(Circuit, OperatingPoint)

    Circuit = makeBlock({
        V: DCVoltage({voltage: Volts(5)}),
        T: NMos({})
    }).connect((_) => [
        _.V.pos.to.T.drain,
       _.Ground.to.T.gate, // Gate is grounded
                 _.T.source.to.Ground,
                 _.T.base.to.Ground,
        _.V.neg.to.Ground
    ]);

    const simOff = await Simulate(Circuit, OperatingPoint)

    // Check that when voltage is applied the current through the source is more than when off
    assert(Math.abs(simOn.circuit.T.is[0]) > Math.abs(simOff.circuit.T.is[0]));
});

Deno.test("PMos is a PMos", async () => {
    let Circuit = makeBlock({
        V: DCVoltage({voltage: Volts(5)}),
        T: PMos({})
    }).connect((_) => [
        _.V.pos.to.T.source,
        _.V.pos.to.T.gate, // Gate is connected to V
                 _.T.drain.to.Ground,
                 _.T.base.to.Ground,
        _.V.neg.to.Ground
    ]);

    const simOn = await Simulate(Circuit, OperatingPoint)

    Circuit = makeBlock({
        V: DCVoltage({voltage: Volts(5)}),
        T: PMos({})
    }).connect((_) => [
        _.V.pos.to.T.drain,
       _.Ground.to.T.gate, // Gate is grounded
                 _.T.source.to.Ground,
                 _.T.base.to.V.pos,
        _.V.neg.to.Ground
    ]);

    const simOff = await Simulate(Circuit, OperatingPoint)

    // Check that when voltage is applied the current through the source is less than when off
    assert(Math.abs(simOn.circuit.T.is[0]) < Math.abs(simOff.circuit.T.is[0]));
});

Deno.test("Test NMOS current mirror", async () => {
    const Circuit = makeBlock({
        I: DCCurrent({current: Amps(-1e-3)}),
        Mirror: DoubleNMosCurrentMirror,
        V1: DCVoltage({voltage: Volts(10)}),
        V2: DCVoltage({voltage: Volts(10)}),
    }).connect((_) => [
        _.Mirror.Bias.to.I.pos,
        _.Mirror.Sink.to.Ground,

        _.V1.pos.to.Mirror.Drain1,
        _.V1.neg.to.Ground,

        _.V2.pos.to.Mirror.Drain2,
        _.V2.neg.to.Ground,

        _.I.neg.to.Ground,
    ]);
    const sim = await Simulate(Circuit, OperatingPoint)
    // Check that current is flowing
    assertNotEquals(sim.circuit.I.c[0], 0)

    // And that it is equal
    assertClose(sim.circuit.I.c[0], sim.circuit.V1.i[0])
    assertClose(sim.circuit.I.c[0], sim.circuit.V2.i[0])
})

Deno.test("Test PMOS current mirror", async () => {
    const Circuit = makeBlock({
        I: DCCurrent({current: Amps(-1e-3)}),
        Mirror: PMosCurrentMirror,
        V: DCVoltage({voltage: Volts(10)}),
    }).connect((_) => [
        _.V.pos.to.Mirror.Source,
                 _.Mirror.Bias.to.I.pos,
                                _.I.neg.to.Ground,

        _.Ground.to.Mirror.Mirrored,

        _.V.neg.to.Ground
    ]);
    const sim = await Simulate(Circuit, OperatingPoint)

    // Check that current is flowing
    assertNotEquals(sim.circuit.I.c[0], 0)

    // And that it is equal (and opposite)
    assertClose(-sim.circuit.I.c[0], sim.circuit.V.i[0])
})

Deno.test("Test Common Source Amplifier", async () => {
    const Circuit = (vin: number) => makeBlock({
        I: DCCurrent({current: Amps(-1e-4)}),
        VDD: DCVoltage({voltage: Volts(10)}),
        VIn: DCVoltage({voltage: Volts(vin)}),
        Amp: CommonSourceAmplifier,
        RLoad: Resistor({resistance: Ohms(5e3)})
    }).connect((_) => [
        _.VDD.pos.to.Amp.Source,
        _.VIn.pos.to.Amp.In,
                   _.Amp.Out.to.RLoad.left,
                              _.RLoad.right.to.Ground,
                   _.Amp.Drain.to.I.pos,
                                _.I.neg.to.Ground,
        _.VDD.neg.to.Ground,
        _.VIn.neg.to.Ground
    ]);
    const simA = await Simulate(Circuit(0), OperatingPoint)
    const simB = await Simulate(Circuit(10), OperatingPoint)

    // Since we haven't been careful to bias things, just make sure this inverts at all
    assertGreaterThan(simA.circuit.Amp.Out[0], simB.circuit.Amp.Out[0])
})

Deno.test("Test Differential Pair", async () => {
    const Circuit = (vin: number) => makeBlock({
        I: DCCurrent({current: Amps(1e-3)}),
        VDD: DCVoltage({voltage: Volts(10)}),
        RL: Resistor({resistance: Ohms(1e4)}),
        RR: Resistor({resistance: Ohms(1e4)}),
        VIn: DCVoltage({voltage: Volts(vin)}),
        DiffPair: DifferentialPair,
    }).connect((_) => [
        _.VDD.pos.to.RL.left,                                            _.RR.left.to.VDD.pos,
                   _.RL.right.to.DiffPair.OutNeg,     _.DiffPair.OutPos.to.RR.right,
                    _.VIn.neg.to.DiffPair.InNeg,      _.DiffPair.InPos.to.VIn.pos,
                                      _.DiffPair.Source.to.I.pos,
                                                         _.I.neg.to.Ground,
        _.VDD.neg.to.Ground,
        _.VIn.neg.to.Ground
    ]);

    // Check the zero point
    let sim = await Simulate(Circuit(0), OperatingPoint)
    assertClose(sim.circuit.DiffPair.OutPos[0], sim.circuit.DiffPair.OutNeg[0]);

    // Check that gain is symmetric
    sim = await Simulate(Circuit(1), OperatingPoint)
    const gainA = sim.circuit.DiffPair.OutPos[0] - sim.circuit.DiffPair.OutNeg[0];
    sim = await Simulate(Circuit(-1), OperatingPoint)
    const gainB = (sim.circuit.DiffPair.OutPos[0] - sim.circuit.DiffPair.OutNeg[0])/-1;
    assertClose(gainA, gainB);

    // Check that it's greater than 1 (more a function of the test harness than anything)
    assertGreaterThan(Math.abs(gainA), 1);
})

Deno.test("Test op-amp", async () => {
    const Circuit = (vin: number) => makeBlock({
        VDD: DCVoltage({voltage: Volts(12)}),
        VSS: DCVoltage({voltage: Volts(12)}),
        Vin: DCVoltage({voltage: Volts(vin)}),
        Bias: DCCurrent({current: Amps(-1e-3)}),
        OpAmp: OpAmp,
        Out: Port,
    }).connect((_) => [
        _.VDD.pos.to.OpAmp.VDD,
        _.VDD.neg.to.Ground,

        _.VSS.pos.to.Ground,
        _.VSS.neg.to.OpAmp.VSS,

        _.Vin.pos.to.OpAmp.InPos,
        _.Vin.neg.to.Ground,
        _.Ground.to.OpAmp.InNeg,

        _.OpAmp.Out.to.Out,

        _.Bias.pos.to.OpAmp.Bias,
        _.Bias.neg.to.Ground,
    ]);

    const sim = await Simulate(Circuit(-1), OperatingPoint)

    console.log(`

Power Supply Currents:
    VDD: ${sim.circuit.VDD.i}
    VSS: ${sim.circuit.VSS.i}
Bias Current: ${sim.circuit.OpAmp.MasterCurrentMirror.Ref.id}

Differential Steered Current: ${sim.circuit.OpAmp.MasterCurrentMirror.Mirror1.id}
Left Current: ${sim.circuit.OpAmp.DiffPairCurrentMirror.Ref.id}
Right Current: ${sim.circuit.OpAmp.DiffPairCurrentMirror.Mirror.id}
Diffpair Output Voltage: ${sim.circuit.OpAmp.DiffPair.OutPos}
Output Amp Current: ${sim.circuit.OpAmp.MasterCurrentMirror.Mirror2.id}
Output Voltage: ${sim.circuit.OpAmp.Out}
    `)

    const out = []
    for (let i = -10; i <= 10; i += 0.25) {
        const sim = await Simulate(Circuit(i), OperatingPoint)
        out.push(sim.circuit.OpAmp.DiffPair.OutPos[0])
    }

    console.log(plot(out, { height: 40 }))
})