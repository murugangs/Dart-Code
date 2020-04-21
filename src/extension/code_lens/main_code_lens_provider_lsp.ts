import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, TextDocument, workspace } from "vscode";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { lspToRange } from "../../shared/vscode/utils";
import { LspAnalyzer } from "../analysis/analyzer_lsp";

export class LspMainCodeLensProvider implements CodeLensProvider, IAmDisposable {
	private disposables: IAmDisposable[] = [];
	private onDidChangeCodeLensesEmitter: EventEmitter<void> = new EventEmitter<void>();
	public readonly onDidChangeCodeLenses: Event<void> = this.onDidChangeCodeLensesEmitter.event;

	constructor(private readonly logger: Logger, private readonly analyzer: LspAnalyzer) {
		this.disposables.push(this.analyzer.fileTracker.onOutline.listen((_) => {
			this.onDidChangeCodeLensesEmitter.fire();
		}));
	}

	public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | undefined {
		// This method has to be FAST because it affects layout of the document (adds extra lines) so
		// we don't already have an outline, we won't wait for one. A new outline arriving will trigger a
		// re-request anyway.
		const outline = this.analyzer.fileTracker.getOutlineFor(document.uri);
		if (!outline || !outline.children || !outline.children.length)
			return;

		const runConfigs = workspace.getConfiguration("launch", document.uri).get<any[]>("configurations") || [];
		const runFileTemplates = runConfigs.filter((c) => c && c.type === "dart" && c.template && (c.template === "run-file" || c.template === "debug-file"));

		const mainMethod = outline.children?.find((o) => o.element.name === "main");
		if (!mainMethod)
			return;

		return [
			new CodeLens(
				lspToRange(mainMethod.range),
				{
					arguments: [document.uri],
					command: "dart.startWithoutDebugging",
					title: "Run",
				},
			),
			new CodeLens(
				lspToRange(mainMethod.range),
				{
					arguments: [document.uri],
					command: "dart.startDebugging",
					title: "Debug",
				},
			),
		].concat(runFileTemplates.map((t) => new CodeLens(
			lspToRange(mainMethod.range),
			{
				arguments: [document.uri, t],
				command: t.template === "run-file" ? "dart.startWithoutDebugging" : "dart.startDebugging",
				title: t.name,
			},
		)));
	}

	public dispose(): any {
		this.disposables.forEach((d) => d.dispose());
	}
}