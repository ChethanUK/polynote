'use strict';

import * as fastEquals from 'fast-deep-equal/es6';

export function deepEquals<T>(a: T, b: T, ignoreKeys?: (keyof T)[]): boolean {
    if (ignoreKeys && a && b) {
        a = ignoreKeys.reduce((acc: T, key: keyof T) => {
            return removeKeys(acc, key)
        }, a)
        b = ignoreKeys.reduce((acc: T, key: keyof T) => {
            return removeKeys(acc, key)
        }, b)
    }
    return fastEquals(a, b)
}

// Shallow Equality that handles empty objects / arrays
export function shallowEquals<T>(a: T, b: T): boolean {
    if (a === b) return true

    if (isObject(a) && isObject(b) && isEmpty(a) && isEmpty(b)) {
        return true
    }

    return Array.isArray(a) && Array.isArray(b) && isEmpty(a) && isEmpty(b);

}

//*********************
//* Object helpers
//*********************

// Checks if variable is an object (and not an array, even though arrays are technically objects). Maybe there's a more correct name for this method.
export function isObject(obj: any): obj is object {
    return obj && typeof obj === "object" && !Array.isArray(obj)
}

export function isEmpty(obj: object): boolean {
    return obj && Object.keys(obj).length === 0
}

export function diffArray<T>(a: T[], b: T[], equals: (a: T, b: T) => boolean = (a: T, b: T) => deepEquals(a, b)): [T[], T[]] {
    const aNotB = a.filter(x => b.findIndex(el => equals(x, el)) === -1);
    const bNotA = b.filter(x => a.findIndex(el => equals(x, el)) === -1);
    return [aNotB, bNotA]
}

export function changedKeys<T extends Record<string, any>>(oldT: T, newT: T): (keyof T)[] {
    if (deepEquals(oldT, newT)) {
        return []
    } else {
        return Object.keys(oldT).reduce((acc: string[], next: string) => {
            if (!deepEquals(oldT[next], newT[next])) {
                acc.push(next)
            }
            return acc
        }, [])
    }
}

export function deepFreeze<T>(obj: T) {
    function go(obj: T) {
        if (obj && typeof obj === "object") {
            Object.values(obj).forEach(v => go(v))
            return Object.isFrozen(obj) ? obj : Object.freeze(obj)
        } else {
            return obj
        }
    }

    return go(obj)
}

export function equalsByKey<A, B>(a: A, b: B, keys: NonEmptyArray<(keyof A & keyof B)>): boolean {
    return keys.every(k => {
        if (k in a && k in b) {
            return deepEquals(a[k], b[k] as any) // TODO: is there a way to fiddle with the types so this works without any?
        } else return false
    })
}

export function removeKeys<T>(obj: T, k: (keyof T)[] | keyof T): T {
    let keyStrings: string[];
    if (k instanceof Array) {
        keyStrings = k.map(key => key.toString())
    } else {
        keyStrings = [k.toString()]
    }
    return Object.keys(obj).reduce((acc: T, key: string) => {
        if (! keyStrings.includes(key)) {
            return { ...acc, [key]: obj[key as keyof T] }
        }

        return acc
    }, {} as T)
}

export function mapValues<V, U>(obj:{ [K in PropertyKey]: V }, f: (x: V) => U): { [K in PropertyKey]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}

//*********************
//* Array helpers
//*********************

export function arrInsert<T>(arr: T[], idx: number, t: T) {
    if (idx > -1) {
        return [...arr.slice(0, idx), t, ...arr.slice(idx)]
    } else return [t, ...arr]
}

export function arrReplace<T>(arr: T[], idx: number, t: T) {
    if (idx > -1) {
        return [...arr.slice(0, idx), t, ...arr.slice(idx + 1)]
    } else return [t, ...arr]
}

export function arrDelete<T>(arr: T[], idx: number) {
    if (idx > -1) {
        return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
    } else return arr
}

export function arrDeleteFirstItem<T>(arr: T[], item: T) {
    const idx = isObject(item) || Array.isArray(item)
        ? arr.findIndex(i => deepEquals(i, item))
        : arr.indexOf(item)

    if (idx >= 0) {
        return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
    } else return arr
}

export function unzip<A, B>(arr: [A, B][]): [A[], B[]] {
    return arr.reduce<[A[], B[]]>(([as, bs], [a, b]) => {
        return [[...as, a], [...bs, b]]
    }, [[], []])
}

export function unzip3<A, B, C>(arr: [A, B, C][]): [A[], B[], C[]] {
    return arr.reduce<[A[], B[], C[]]>(([as, bs, cs], [a, b, c]) => {
        return [[...as, a], [...bs, b], [...cs, c]]
    }, [[], [], []])
}

export function collect<T, U>(arr: T[], fun: (t: T) => U | undefined | null): U[] {
    return arr.flatMap(t => {
        const newT = fun(t)
        if (newT !== undefined && newT !== null) {
            return [newT]
        } else return []
    })
}

/**
 * Partitions an array into two arrays according to the predicate.
 *
 * @param arr   T[]
 * @param pred  A predicate of T => boolean
 * @return      A pair of T[]s. The first T[] consists of all elements that satisfy the predicate, the second T[]
 *              consists of all elements that don't. The relative order of the elements in the resulting T[] is the same
 *              as in the original T[].
 */
export function partition<T>(arr: T[], pred: (t: T) => boolean): [T[], T[]] {
    return arr.reduce<[T[], T[]]>((acc, next) => {
        if (pred(next)) {
            return [[...acc[0], next], acc[1]]
        } else {
            return [acc[0], [...acc[1], next]]
        }
    }, [[], []])
}

export function mapSome<T>(arr: T[], cond: (t: T) => boolean, fn: (t: T) => T): T[] {
    return arr.map(item => {
        if (cond(item)) {
            return fn(item)
        } else return item
    })
}

export function arrayStartsWith<T>(base: T[], start: T[]) {
    if (start.length > base.length) return false;

    for (let i = 0; i < start.length; i++) {
        if (! deepEquals(base[i], start[i])) {
            return false;
        }
    }

    return true;
}

//****************
//* Other Helpers
//****************

export class Deferred<T> implements Promise<T> {
    private _promise: Promise<T>;
    resolve: (value?: (PromiseLike<T> | T)) => void;
    reject: (reason?: any) => void;

    isSettled: boolean = false;

    // To implement Promise
    readonly [Symbol.toStringTag]: string;

    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            // assign the resolve and reject functions to `this`
            // making them usable on the class instance
            this.resolve = resolve;
            this.reject = reject;
        });
        // bind `then` and `catch` to implement the same interface as Promise
        this.then = this._promise.then.bind(this._promise);
        this.catch = this._promise.catch.bind(this._promise);
        this[Symbol.toStringTag] = 'Promise';

        this.finally(() => {
            this.isSettled = true
        })
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null): Promise<TResult1 | TResult2> {
        return this._promise.then(onfulfilled, onrejected);
    }

    catch<TResult = never>(onrejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null): Promise<T | TResult> {
        return this._promise.catch(onrejected);
    }

    finally(onfinally?: (() => void) | undefined | null): Promise<T> {
        return this._promise.finally(onfinally);
    }

}

export function nameFromPath(path: string): string {
    return path.split(/\//g).pop()!;
}