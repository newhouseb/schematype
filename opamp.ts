import { makeBlock, Port, Resistor, DCVoltage, Ohms, SPICE, Volts, Simulate, ACVoltage, Transient, watchParameters, Nanoseconds, Capacitor, Farads, Microseconds, OperatingPoint, Hertz, Seconds, CircuitComponent, AsString, ExpandOnce } from "./index.ts"
import { plot } from "https://deno.land/x/chart/mod.ts";

export const NMos = watchParameters(SPICE`M${'name'} ${'source:port'} ${'gate:port'} ${'drain:port'} ${'base:port'} MOD1 L=4U W=6U AD=10P AS=10P
.MODEL MOD1 NMOS`, ["id", "ig", "is", "vds", "vgs"])

export const PMos = watchParameters(SPICE`M${'name'} ${'source:port'} ${'gate:port'} ${'drain:port'} ${'base:port'} MOD2 L=4U W=6U AD=10P AS=10P
.MODEL MOD2 PMOS`, ["id", "ig", "is", "vds", "vgs"])

export const DoubleNMosCurrentMirror = makeBlock({
    Bias: Port,
    Sink: Port,
    Ref: NMos({}),

    Mirror1: NMos({}),
    Drain1: Port,

    Mirror2: NMos({}),
    Drain2: Port,
}).connect((_) => [
    _.Bias.to.Ref.source,
            _.Ref.source.to.Ref.gate,
            _.Ref.drain.to.Sink,
            _.Ref.base.to.Ref.drain,

      _.Drain1.to.Mirror1.source,
    _.Ref.gate.to.Mirror1.gate,
                _.Mirror1.drain.to.Sink,
                _.Mirror1.base.to.Mirror1.drain,

      _.Drain2.to.Mirror2.source,
    _.Ref.gate.to.Mirror2.gate,
                _.Mirror2.drain.to.Sink,
                _.Mirror2.base.to.Mirror1.drain,
]);

export const PMosCurrentMirror = makeBlock({
    Source: Port,
    Bias: Port,
    Ref: PMos({}),

    Mirror: PMos({}),
    Mirrored: Port,
}).connect((_) => [
  _.Source.to.Ref.source,
            _.Ref.drain.to.Ref.gate,
            _.Ref.drain.to.Bias,
            _.Ref.base.to.Ref.source,

    _.Source.to.Mirror.source,
  _.Ref.gate.to.Mirror.gate,
              _.Mirror.drain.to.Mirrored,
              _.Mirror.base.to.Mirror.source,
]);

export const DifferentialPair = makeBlock({
    Neg: NMos({}),
    Pos: NMos({}),
    InPos: Port,
    InNeg: Port,
    OutPos: Port,
    OutNeg: Port,
    Source: Port
}).connect((_) => [
   _.OutNeg.to.Neg.drain,                          _.Pos.drain.to.OutPos,
    _.InNeg.to.Neg.gate,                           _.Pos.gate.to.InPos,
             _.Neg.source.to.Source,     _.Source.to.Pos.source,
             _.Neg.base.to.Neg.source, _.Pos.base.to.Pos.source
])

// TODO: Add capacitor
export const CommonSourceAmplifier = makeBlock({
    In: Port,
    Out: Port,
    Source: Port,
    Drain: Port,
    FET: PMos({})
}).connect((_) => [
  _.Source.to.FET.source,
      _.In.to.FET.gate,
            _.FET.drain.to.Out,
            _.FET.drain.to.Drain,

            _.FET.base.to.FET.source
])

export const OpAmp = makeBlock({
    VDD: Port,
    VSS: Port,
    Bias: Port,

    InPos: Port,
    InNeg: Port,
    Out: Port,

    DiffPairCurrentMirror: PMosCurrentMirror,
    DiffPair: DifferentialPair,
    MasterCurrentMirror: DoubleNMosCurrentMirror,
    OutputAmplifier: CommonSourceAmplifier 
}).connect((_) => [
                                  _.VDD.to.DiffPairCurrentMirror.Source,                           _.VDD.to.OutputAmplifier.Source,
    _.DiffPairCurrentMirror.Bias.to.DiffPair.OutNeg, _.DiffPairCurrentMirror.Mirrored.to.DiffPair.OutPos,
                         _.InNeg.to.DiffPair.InNeg,                                    _.DiffPair.InPos.to.InPos,
                                                                                       _.DiffPair.OutNeg.to.OutputAmplifier.In,
                                                                                                          _.OutputAmplifier.Out.to.Out,
                                  _.DiffPair.Source.to.MasterCurrentMirror.Drain1,                        _.OutputAmplifier.Drain.to.MasterCurrentMirror.Drain2, 
    _.Bias.to.MasterCurrentMirror.Bias,
    _.VSS.to.MasterCurrentMirror.Sink,
])


