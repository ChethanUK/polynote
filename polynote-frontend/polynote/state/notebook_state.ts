import {StateHandler, StateView} from "./state_handler";
import {
    ClientResult, CompileErrors,
    Output,
    PosRange,
    ResultValue, RuntimeError,
    ServerErrorWithCause
} from "../data/result";
import {CompletionCandidate, HandleData, ModifyStream, Signatures, TaskStatus} from "../data/messages";
import {CellComment, CellMetadata, NotebookConfig} from "../data/data";
import {KernelState} from "./kernel_state";
import {ContentEdit} from "../data/content_edit";
import {EditBuffer} from "../data/edit_buffer";
import {NotebookMessageDispatcher} from "../messaging/dispatcher";
import {availableResultValues} from "../interpreter/client_interpreter";

export type Outputs = Output[] & { clear?: boolean }
export function outputs(outputs: Output[], clear?: boolean): Outputs {
    const result = outputs as Outputs;
    if (clear !== undefined) {
        result.clear = clear;
    }
    return result;
}

export interface CellState {
    id: number,
    language: string,
    content: string,
    metadata: CellMetadata,
    comments: Record<string, CellComment>,
    output: Outputs,
    results: (ResultValue | ClientResult)[],
    compileErrors: CompileErrors[],
    runtimeError: RuntimeError | undefined,
    // ephemeral states
    pendingEdits: ContentEdit[],
    presence: {id: number, name: string, color: string, range: PosRange, avatar?: string}[];
    editing: boolean,
    selected: boolean,
    error: boolean,
    running: boolean
    queued: boolean,
    currentSelection: PosRange | undefined,
    currentHighlight: { range: PosRange, className: string} | undefined
}

export type CompletionHint = { cell: number, offset: number; completions: CompletionCandidate[] }
export type SignatureHint = { cell: number, offset: number, signatures?: Signatures };
export type NBConfig = {open: boolean, config: NotebookConfig}

export interface NotebookState {
    // basic states
    path: string,
    cells: Record<number, CellState>, // cellId -> state
    cellOrder: number[], // this is the canonical ordering of the cells.
    config: NBConfig,
    kernel: KernelState,
    // version
    // TODO: make sure the global and local versions are properly updated
    globalVersion: number,
    localVersion: number,
    editBuffer: EditBuffer,
    // ephemeral states
    activeCellId: number | undefined,
    activeCompletion: { resolve: (completion: CompletionHint) => void, reject: () => void } | undefined,
    activeSignature: { resolve: (signature: SignatureHint) => void, reject: () => void } | undefined,
    activePresence: Record<number, { id: number, name: string, color: string, avatar?: string, selection?: { cellId: number, range: PosRange}}>,
    // map of handle ID to message received.
    activeStreams: Record<number, (HandleData | ModifyStream)[]>
}

export class NotebookStateHandler extends StateHandler<NotebookState> {
    constructor(state: NotebookState) {
        super(state);
    }

    availableValuesAt(id: number, dispatcher: NotebookMessageDispatcher): Record<string, ResultValue> {
        return availableResultValues(this.state.kernel.symbols, this, dispatcher, id);
    }

    viewAvailableValuesAt(id: number, dispatcher: NotebookMessageDispatcher): StateView<Record<string, ResultValue> | undefined> {
        return this.view("kernel").mapView("symbols", symbols => availableResultValues(symbols, this, dispatcher, id));
    }

    getCellIndex(cellId: number, cellOrder: number[] = this.state.cellOrder): number | undefined {
        return cellOrder.indexOf(cellId)
    }

    getCellIdAtIndex(cellIdx: number): number | undefined {
        return this.state.cellOrder[cellIdx]
    }

    getPreviousCellId(anchorId: number, cellOrder: number[] = this.state.cellOrder): number | undefined {
        const anchorIdx = this.getCellIndex(anchorId, cellOrder)
        return anchorIdx ? cellOrder[anchorIdx - 1] : undefined
    }

    getNextCellId(anchorId: number, cellOrder: number[] = this.state.cellOrder): number | undefined {
        const anchorIdx = this.getCellIndex(anchorId, cellOrder)
        return anchorIdx ? cellOrder[anchorIdx + 1] : undefined
    }


    // wait for cell to transition to a specific state
    waitForCellChange(id: number, targetState: "queued" | "running" | "error"): Promise<undefined> {
        return new Promise(resolve => {
            const obs = this.addObserver(state => {
                const maybeChanged = state.cells[id];
                if (maybeChanged && maybeChanged[targetState]) {
                    this.removeObserver(obs)
                    resolve()
                }
            })
        })
    }

    get isLoading(): boolean {
        return !!(this.state.kernel.tasks[this.state.path] ?? false)
    }

    get loaded(): Promise<void> {
        if (!this.isLoading) {
            return Promise.resolve();
        }
        return new Promise<void>(resolve => {
            const tasksView = this.view('kernel').view('tasks');
            tasksView.addObserver((current, prev) => {
                if (!current[this.state.path] || current[this.state.path].status === TaskStatus.Complete) {
                    tasksView.dispose();
                    resolve();
                }
            })
        })
    }
}
