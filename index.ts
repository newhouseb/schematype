type NumberWithUnit<Unit> = number & { __unit: Unit };

type Ohms = NumberWithUnit<'Ohms'>;
export const Ohms = (n: number) => n as Ohms;

type Farads = NumberWithUnit<'Farads'>;
export const Farads = (n: number) => n as Farads;

type Volts = NumberWithUnit<'Volts'>;
export const Volts = (n: number) => n as Volts;

type Hertz = NumberWithUnit<'Hertz'>;
export const Hertz = (n: number) => n as Hertz;

type Amps = NumberWithUnit<'Amps'>
export const Amps = (n: number) => n as Amps;

type Seconds = NumberWithUnit<'Seconds'>;
export const Seconds = (n: number) => n as Seconds;
export const Picoseconds = (n: number) => n*1e-9 as Seconds;
export const Nanoseconds = (n: number) => n*1e-9 as Seconds;
export const Microseconds = (n: number) => n*1e-6 as Seconds;

export type Port = { __port: true };
export const Port = { __port: true } as Port;

type Units = {
    'Ohms': Ohms,
    'Farads': Farads,
    'Volts': Volts,
    'Hertz': Hertz,
    'Amps': Amps,
    'string': string
}

class CircuitNode {
    constructor(public name: string) {}
}


type Parameter<Name extends string, Description extends string> = {
    name: Name,
    desc: Description
}
function Parameter<Name extends string, Description extends string>(name: Name, _desc: Description) {
    return {
        name
    } as Parameter<Name, Description>;
}

const current = Parameter('i', 'The current through the device');

export type CircuitComponent<P extends string, C extends Record<string, unknown>, R=never> = {
    generate: (name: string, componentMap: Map<any, string>, portMap: Map<CircuitNode, number>, paramList: string[]) => string,
    ports: Record<P, CircuitNode>,
    components: C,
    connections?: [[AsString<keyof C>, string] | P | 'Ground', [AsString<keyof C>, string] | P | 'Ground'][],
    deviceParameters?: R[],
}


type CircuitComponentWithParams<T, R> = T extends CircuitComponent<infer P, infer C, never> ? CircuitComponent<P, C, R> : never;

export function watchParameters<F extends (...args: any[]) => any, R extends string>(
                                                    f: F, 
                                                    params: R[]):
        (p: Parameters<F>[0]) => CircuitComponentWithParams<ReturnType<F>, R>
     {

    return (p: Parameters<F>[0]) => {
        let c = f(p)
        c.deviceParameters = params;
        return c as CircuitComponentWithParams<ReturnType<F>, R>
    }
}

type CircuitComponentReadings<P extends string, D extends string, C extends Record<string, unknown>, R> = {
    port: Record<P, R>, // Port voltages
    parameters: Record<D, R>, // Device parameters
    components: C
}

export function SPICE<P extends `${string}:${keyof Units | 'port'}` | 'name'>(strings: TemplateStringsArray, ...args: P[]): 
    (p: GetArgs<P>) => CircuitComponent<GetPortNames<P>, Record<string, never>> {
    return (params: GetArgs<P>) => {
        const ports = Object.assign({},
                ...args.filter((p) => p.endsWith(":port")).map((p) => ({ [p.substr(0, p.length - 5)]: new CircuitNode(p) }))
                ) as Record<GetPortNames<P>, CircuitNode>;
        const self = {
            generate: (name: string, componentMap: Map<any, string>, portMap: Map<CircuitNode, number>, paramList: string[]) => {
                const fullname = strings[0] + name;
                componentMap.set(self, fullname);
                for (const param of (self as any).deviceParameters ?? []) {
                    paramList.push('@' + fullname + '[' + param + ']');
                }

                let out = '';
                for (let i = 0; i < strings.length; i++) {
                    out += strings[i];
                    if (i < args.length) {
                        if (args[i] === 'name') {
                            out += name;
                        } else if (args[i].endsWith(':port')) {
                            const node = portMap.get((ports as any)[args[i].split(':')[0]]);
                            if (node === undefined) {
                                throw Error("Failed to find port: " + name + '.' + args[i]);
                            }
                            out += node.toString();
                        } else {
                            const param = (params as any)[args[i].split(':')[0]];
                            if (param === undefined) {
                                throw Error("Failed to find param: " + name + ":" + args[i]);
                            }
                            out += param;
                        }
                    }
                }
                return out + '\n';
            },
            ports,
            components: {}
        };
        return self;
    }
}

type GetPortNames<T> = T extends `${infer S}:port` ? S : never;
type GetArgs<T> = ExpandOnce<UnionToIntersection<T extends `${infer S}:${infer U}` ? (U extends keyof Units ? { [key in S]: Units[U] } : never) : never>>;
export type ExpandRecursively<T> = T extends object ? T extends infer O ? { [K in keyof O]: ExpandRecursively<O[K]> } : never : T;
export type ExpandOnce<T> = T extends object ? T extends infer O ? { [K in keyof O]: O[K] } : never : T;
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never
type ComponentPorts<T> = T extends CircuitComponent<infer P, infer C, infer R> ? P : never;

type LeftNode<T extends object> = { [from in keyof T | 'Ground']: from extends KeysNotMatching<T, Port> ? { 
    [from_port in ComponentPorts<T[from]>]: {
        to: {
            [to in keyof T | 'Ground']: to extends KeysNotMatching<T, Port> ? {
                [to_port in ComponentPorts<T[to]>]: 
                    `${AsString<from>}.${from_port}` | `${AsString<to>}.${to_port}`
            } : `${AsString<from>}.${from_port}` | to 
        }
    } 
} : { 
        to: {
            [to in keyof T]: {
                [to_port in ComponentPorts<T[to]>]: 
                    from | `${AsString<to>}.${to_port}`
            }
        }
    }
};
type CollapseArray<T> = number extends keyof T ? T[number] : [never, T, "is not an array"];
type AllComponentPortsIntermediate<T> = { [from in keyof T]: { [from_port in ComponentPorts<T[from]>]: `${AsString<from>}.${from_port}` }} 
type AllComponentPorts<T> = AllComponentPortsIntermediate<T> extends Record<infer A, infer B> ? 
    (B extends Record<infer C, infer D> ? D | 'Ground' : never) 
    : never;

class Ports {
    list: string[];
    constructor(previous: string[]) {
      this.list = previous;
    }
  }
  
function Connection(previous: Ports): any {
    return new Proxy(previous, {
        get: function(target, prop, _receiver) {
            if (prop == '__list') {
                return Reflect.get(target, 'list');
            }
            if (typeof prop === 'symbol') {
                throw Error('Symbols not allowed')
            }
            previous.list.push(prop);
            return Connection(previous);
        }
    });
}

function desugarConnection(parts: string[]): [readonly [string, string] | string, readonly [string, string] | string] {
    const toIdx = parts.indexOf('to');
    let from: readonly [string, string] | string;
    let to: readonly [string, string] | string;
    if (toIdx === -1) {
        throw Error("Bad connection: " + parts.join('.'));
    }
    if (toIdx === 1) {
        from = parts[0];
        if (parts.length === 3) {
            to = parts[2];
        } else if (parts.length === 4) {
            to = [parts[2], parts[3]];
        } else {
            throw Error("Bad connection: " + parts.join('.'));
        }
    } else if (toIdx === 2) {
        from = [parts[0], parts[1]];
        if (parts.length === 4) {
            to = parts[3];
        } else if (parts.length === 5) {
            to = [parts[3], parts[4]];
        } else {
            throw Error("Bad connection: " + parts.join('.'));
        }
    } else {
        throw Error("Bad connection: " + parts.join('.'));
    }
    return [from, to];
}


type KeysMatching<T extends object, V> = {
    [K in keyof T]-?: T[K] extends V ? K : never
  }[keyof T];
export type KeysNotMatching<T extends object, V> = {
    [K in keyof T]-?: T[K] extends V ? never : K 
  }[keyof T];
export type AsString<T> = T extends string ? T : never;

export function makeBlock<T extends Record<string, CircuitComponent<string, any, any> | Port>>(t: T) {
    return {
        connect<U extends (_: LeftNode<T>) => any>(
                cb: Exclude<AllComponentPorts<T> | KeysMatching<T, Port>, CollapseArray<ReturnType<U>> | 'Ground'> extends never ? 
                        (Exclude<CollapseArray<ReturnType<U>>, AllComponentPorts<T> | KeysMatching<T, Port>> extends never ?
                            U : [never, "Invalid connection:", Exclude<CollapseArray<ReturnType<U>>, AllComponentPorts<T> | KeysMatching<T, Port>>])
                        : [never, "Floating connections for", Exclude<AllComponentPorts<T> | KeysMatching<T, Port>, CollapseArray<ReturnType<U>> | 'Ground'>]):
                        CircuitComponent<AsString<KeysMatching<T, Port>>, T> {
            const _ = new Proxy({}, {
                get: function(_target, prop, _receiver) {
                    if (typeof prop === 'symbol') {
                        throw Error('Symbols not allowed')
                    }
                    return Connection(new Ports([prop]))
                }
            });
            const connections = (cb as any)(_ as LeftNode<T>).map((c: any) => desugarConnection(c.__list));

            return {
                generate: (name: string, componentMap: Map<any, string>, portMap: Map<CircuitNode, number>, paramList: string[]) => {
                    return Object.keys(t)
                        .filter((k) => (t[k] as Port).__port === undefined)
                        .map((k) => (t[k] as CircuitComponent<string, any>)
                            .generate(name + '_' + k, componentMap, portMap, paramList))
                        .join('');
                },
                ports: Object.assign({},
                    ...Object.keys(t).filter((k) => (t[k] as Port).__port).map((k) => ({ [k]: new CircuitNode(k) }))
                    ) as Record<KeysMatching<T, Port> | 'derp', CircuitNode>,
                components: t,
                connections
            }
        }
    }
}

type Analysis<T extends number | number[]> = {
    analysis: () => string
    kind: T
}

export const OperatingPoint = {
    analysis: () => '.op',
    kind: 0
}

export function Transient(p: { step: Seconds, stop: Seconds }) {
    return {
        analysis: () => `.tran ${p.step} ${p.stop}\n`,
        kind: [0]
    }
}

type GetSimulationResult<T> = T extends CircuitComponent<infer P, infer C, infer R> ? ExpandOnce<{
    deviceName?: string 
} & {
    [key in P]: number[] 
} & {
    [key in AsString<R>]: number[] 
} & (Record<string, never> extends C ? unknown : {
    [key in keyof C]: C[key] extends Port ? unknown : GetSimulationResult<C[key]>
})>: never;

export async function Simulate<C extends CircuitComponent<P, I, R>, R, P extends string, I extends Record<string, unknown>,
    A extends Analysis<S>, S extends number | number[]
    >(c: C, a: A) {
    const siblings = new Map<CircuitNode, CircuitNode[]>();
    const GroundNode = new CircuitNode("Ground");

    const trace = <C2 extends CircuitComponent<P2, I2, R2>, R2, P2 extends string, I2 extends Record<string, unknown>>(c: C2) => {
        const getNode = (n: [string, string] | string) => {
            if (Array.isArray(n)) {
                return (c.components[n[0]] as CircuitComponent<string, Record<string, unknown>>).ports[n[1]]
            }
            if (n === 'Ground') return GroundNode;
            return (c.ports as any)[n];
        }
        for (const connection of c.connections ?? []) {
            let [l, r] = [getNode(connection[0]), getNode(connection[1])];
            if (!siblings.has(l)) siblings.set(l, []);
            if (!siblings.has(r)) siblings.set(r, []);
            siblings.set(l, siblings.get(l)!.concat([r]));
            siblings.set(r, siblings.get(r)!.concat([l]));
        }
        for (const key of Object.keys(c.components ?? {})) {
            trace(c.components[key] as C2);
        }
    }
    trace(c);

    const colored = new Map<CircuitNode, number>()
    let color = 0;
    for (const node of siblings) {
        if (colored.has(node[0])) {
            continue;
        }
        color += 1;
        const explored = new Set<CircuitNode>();
        let toExplore = [node[0]];
        while (toExplore.length > 0) {
            const next = toExplore.pop()!;
            if (explored.has(next)) continue;
            colored.set(next, color);
            explored.add(next);
            toExplore = toExplore.concat(siblings.get(next)!);
        }
    }

    // Zero out ground (it tends to get reassigned in the above algorithm)
    const OldGround = colored.get(GroundNode);
    if (!OldGround) {
        throw Error("Nothing tied to ground")
    }
    for (const [node, num] of colored) {
        if (num === OldGround) {
            colored.set(node, 0);
        }
    }

    const componentMap = new Map<any, string>();
    const paramList = [] as string[];
    const spice = `autogen
${c.generate('TOP', componentMap, colored, paramList)}
.options filetype = ascii
.save all ${paramList.join(' ')}
${a.analysis()}
.end`;

    const ngspice = Deno.run(({ 
        cmd: ["ngspice", "-s"],
        stdin: "piped",
        stdout: "piped",
        stderr: "null"
    }))
    await ngspice.stdin.write(new TextEncoder().encode(spice))
    await ngspice.stdin.close();
    await ngspice.status();
    const rawfile = new TextDecoder().decode(await ngspice.output());
    ngspice.close();

    let readingData = false;
    let readingCols = false;
    let seriesIdx = 0;
    let varCount = 0;
    const series = [] as number[][];
    const cols = [];
    for (const line of rawfile.split('\n')) {
        if (line.trim() == '') continue;
        if (line.startsWith("No. of Data Columns")) {
            readingCols = true;
            continue;
        }
        if (line.startsWith('No. Variables:')) {
            varCount = parseInt(line.split(':')[1].trim());
            for (let i = 0; i < varCount; i++) {
                series.push([])
            }
            continue;
        }
        if (line.startsWith('Values:')) {
            readingData = true;
            readingCols = false;
            continue;
        }
        if (readingCols) {
            const parts = line.split('\t')
            if (parts[0] == "")
                cols.push([parts[2], parts[3]])
        }
        if (readingData) {
            if (line[0] !== '\t') {
                seriesIdx = 0;
                series[seriesIdx].push(parseFloat(line.split('\t')[2]))
            } else {
                series[seriesIdx].push(parseFloat(line.split('\t')[1]))
            }
            seriesIdx += 1;
            if (line[0] === '@') {
                break;
            }
        }
    }

    const nodeData = new Map<number, any>();
    nodeData.set(0, Array(series[0].length).fill(0));
    const deviceParamsData = {} as Record<string, Record<string, any>>;
    cols.map((col, i) => {
        const nodeVoltage = col[0].match(/^v\(([0-9]+)\)$/);
        const deviceParam = col[0].match(/^[a-z]\(@([^[]+)\[([a-z]+)\]\)$/);
        const deviceParamAlt = col[0].match(/^@([^[]+)\[([a-z]+)\]$/);
        if (nodeVoltage) {
            nodeData.set(parseInt(nodeVoltage[1]), series[i]);
        } else if (deviceParam) {
            deviceParamsData[deviceParam[1]] = {
                ...deviceParamsData[deviceParam[1]] || {},
                [deviceParam[2]]: series[i]
            }
        } else if (deviceParamAlt) {
            deviceParamsData[deviceParamAlt[1]] = {
                ...deviceParamsData[deviceParamAlt[1]] || {},
                [deviceParamAlt[2]]: series[i]
            }
        }
    })

    const propagateMeasurements = <C2 extends CircuitComponent<P2, I2, R2>, R2, P2 extends string, I2 extends Record<string, unknown>>(c: C2): any => {
        return Object.assign({deviceName: componentMap.get(c)},
                ...[...Object.keys(c.ports).map((p) => ({ [p]: nodeData.get(colored.get((c.ports as any)[p])!) })),
                 ...Object.keys(c.components)
                    .filter((s: string) => (c.components[s] as Port).__port !== true)
                    .map((s: string) => ({ [s]: propagateMeasurements(c.components[s] as C2) })),
                componentMap.get(c) ? deviceParamsData[componentMap.get(c)!.toLowerCase()] : {}])
    }

    return {
        spice,
        rawfile,
        data: series,
        circuit: propagateMeasurements(c) as GetSimulationResult<C>
    }
}

export const DCVoltage = watchParameters(SPICE`V${'name'} ${'pos:port'} ${'neg:port'} ${'voltage:Volts'}`, ["i", "p"])
export const DCCurrent = watchParameters(SPICE`I${'name'} ${'pos:port'} ${'neg:port'} ${'current:Amps'}`, ["c", "p"])
export const ACVoltage = SPICE`V${'name'} ${'pos:port'} ${'neg:port'} SIN(${'offset:Volts'} ${'amplitude:Volts'} ${'freq:Hertz'})`;
export const Resistor = watchParameters(SPICE`R${'name'} ${'left:port'} ${'right:port'} ${'resistance:Ohms'}`, ["i", "p"]);
export const Capacitor = SPICE`C${'name'} ${'left:port'} ${'right:port'} ${'capacitance:Farads'}`;
export const MOSFET = watchParameters(SPICE`M${'name'} ${'drain:port'} ${'gate:port'} ${'source:port'} ${'base:port'} MOD1 L=4U W=6U AD=10P AS=10P
.MODEL MOD1 NMOS VTO=-2 NSUB=1.0E15 UO=550`, ["id", "ig", "is"])