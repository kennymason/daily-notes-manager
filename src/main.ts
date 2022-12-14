import { App, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile } from 'obsidian';
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';
import { FolderSelect, HeadingSelect } from './Settings/Selecters';
import { isDailyNote, addContentToHeading, getHashLevel, getDayOfTheWeek, parseEmbeddables } from './utils';

interface Settings {
	prevNoteText: string,
	archive: boolean,
	archiveMaxNotes: number,
	archiveFolder: string,
	taskRollover: boolean,
	taskHeading: string,
	copyContentHeadings: Array<[string, string]>,
	modified: {
		[key: string]: string
	},
	dotw: boolean,
	dotwLst: Array<string>,
}

const DEFAULT_SETTINGS: Settings = {
	prevNoteText: "",
	archive: false,
	archiveMaxNotes: 7,
	archiveFolder: '',
	taskRollover: true,
	taskHeading: '',
	copyContentHeadings: [["", ""]],
	modified: {
		curr: '',
		prev: ''
	},
	dotw: false,
	dotwLst: ['', '', '', '', '', '', '']
}

// Just placeholders, not actual defaults
const DEFAULT_DOTW: Array<[string, string]> = [
	["Sunday", "Sunday-Funday"],
	["Monday", "Monday ¯\\_(ツ)_/¯"],
	["Tuesday", "2's Day"],
	["Wednesday", "Hump Day!"],
	["Thursday", "Thirsty Thursday"],
	["Friday", "TGIF!"],
	["Saturday", "Saturday :)"]
];

export default class NoteManager extends Plugin {
	settings: Settings;

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();

		this.registerEvent(this.app.vault.on('create', async (file) => {
			this.onFileCreate(this, file);
		}));

		this.registerEvent(this.app.vault.on('delete', async (file) => {
			await this.onFileDelete(this, file);
		}));

    this.addCommand({
      id: "run-daily-notes-manager",
      name: "Run Daily Notes Manager",
      callback: async () => {
				await this.onRunDNM();
			}
    })

		// creates the icon in the left ribbon
		const ribbonIconEl = this.addRibbonIcon('dice', 'Daily Notes Manager', async (evt: MouseEvent) => {
			await this.onRunDNM();
		});

		// add a settings tab
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {

	}

	async onFileCreate (plugin: NoteManager, file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) {
			return;
		}

		// Only proceed if file is less than 10 seconds old
		if (new Date().getTime() - file.stat.ctime > 10000) {
			return;
		}

		await plugin.onRunDNM(file);
	}

	async onFileDelete (plugin: NoteManager, file: TAbstractFile): Promise<void> {
		if (!(file instanceof TFile)) {
			return;
		}

		// remove note from modified log
		if (plugin.settings.modified.prev == file.basename){
			plugin.settings.modified.prev = '';

			await plugin.saveSettings();
		}
		if (plugin.settings.modified.curr == file.basename){
			plugin.settings.modified.curr = plugin.settings.modified.prev;

			await plugin.saveSettings();
		}
	}

	async onRunDNM (file: TFile | undefined = undefined): Promise<void> {
		// Called when the user runs the 'Run Daily Notes Manager' command or clicks the ribbon icon.
		await this.loadSettings();

		let todayOnly = false;
		if (file == undefined) {
			file = getDailyNote(window.moment(), getAllDailyNotes());
			if (!file) {
				file = await createDailyNote(window.moment());
			}

			todayOnly = true;
		}

		if (!file || !(file instanceof TFile) || !isDailyNote(file, todayOnly)) {
			return;
		}

		if (file.basename != this.settings.modified.curr && file.basename != this.settings.modified.prev) {
			await this.runNoteManager(file);
		}

		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);
	}

	// Only run this function from 'onRunDNM()' - it does vital checks
	async runNoteManager (file: TFile): Promise<void> {
		// return if this note was already modified
		if (this.settings.modified.prev == file.basename || this.settings.modified.curr == file.basename){
			return;
		}
		
		// mark note as modified
		this.settings.modified.prev = this.settings.modified.curr;
		this.settings.modified.curr = file.basename;
		await this.saveSettings();

		// get all notes
		const allNotes = getAllDailyNotes();
		const allKeys = Object.keys(allNotes);

		// sort notes by date
		let sortedKeys = [...allKeys];
		sortedKeys.sort((a: string, b: string): number =>  {
			// keys (DateUID[]) are prefixed with a granularity (day-, month-, year-)
			const x = new Date(a.replace('day-', '').replace('month-', '').replace('year-', ''));
			const y = new Date(b.replace('day-', '').replace('month-', '').replace('year-', ''));
			// Do I need to handle null/undefined Dates? Maybe not, but whatever.
			return (y ? y.getTime() : 0) - (x ? x.getTime() : 0);
		});

		// get previous daily note
		const lastNote = allNotes[sortedKeys[1]];

		// archive old notes if enabled
		if (this.settings.archive) {
			await this.runArchive(allNotes, sortedKeys);
		}

		// rollover unfinished tasks if enabled
		if (this.settings.taskRollover && this.settings.taskHeading) {
			if (lastNote){
				await this.runTasks(lastNote, file);
			}
		}

		// copy over content if enabled
		if (this.settings.copyContentHeadings.length > 0 && lastNote) {
			await this.runContentCopy(lastNote, file, this.settings.copyContentHeadings);
		}

		// run 'Day of the Week'
		if (this.settings.dotw) {
			await this.runDayOfTheWeek(file);
		}

		/* Dynamic Embeddable-Text */
		// runs after "content copy" because otherwise content won't carry over if user puts embeddable text in a heading

		// set link to previous note
		await this.runPreviousEmbeddable(lastNote, file);

		// replace "Current Date" embeddables, replace "Day of the Week" embeddables
		await this.runEmbeddables(file);
	}

	async runEmbeddables (note: TFile): Promise<void> {
		// Handle 'Current Date' and 'Day of the Week' embeddables
		let body = await this.app.vault.read(note);

		body = parseEmbeddables(body, note.basename);

		await this.app.vault.modify(note, body);
	}

	async runDayOfTheWeek (todaysNote: TFile): Promise<void> {
		// Title the note with the day of the week
		const day = getDayOfTheWeek(todaysNote.basename);
		if (day == -1) {
			return;
		}

		const titleStr = parseEmbeddables(this.settings.dotwLst[day] ?? DEFAULT_DOTW[day][0], todaysNote.basename);

		let body = await this.app.vault.read(todaysNote);
		if (body.includes("<#dnm>custom-dotw</#dnm>")) {
			body = body.replace(new RegExp("<#dnm>custom-dotw</#dnm>", 'g'), titleStr);
		}
		else {
			body = "# " + titleStr + "\n" + body;
		}

		await this.app.vault.modify(todaysNote, body);
	}

	async runPreviousEmbeddable (prevNote: TFile, todaysNote: TFile): Promise<void> {
		// Insert link to previous Daily Note
		let body = await this.app.vault.read(todaysNote);

		// parse embeddable date if used
		let customText = parseEmbeddables(this.settings.prevNoteText == '' ? "<#dnm>date</#dnm>" : this.settings.prevNoteText, prevNote.basename);
		const link = "[[" + prevNote.basename + "|" + customText + "]]";

		body = body.replace(new RegExp("<#dnm>previous</#dnm>", 'g'), link);

		await this.app.vault.modify(todaysNote, body);
	}

	async runArchive (allNotes: Record<string, TFile>, keys: string[]): Promise<void> {
		// archive oldest notes
		if (keys.length > this.settings.archiveMaxNotes) {
			for (; keys.length > this.settings.archiveMaxNotes;) {
				const key = keys.pop();
				if (!key) break;

				const note = allNotes[key];
				if (!note) {
					return;
				}

				await this.app.fileManager.renameFile(note, this.settings.archiveFolder + '/' + note.basename + '.md');
			}
		}
	}

	async runTasks (prevNote: TFile, currNote: TFile): Promise<void> {
		// rollover tasks from previous note
    const contents = await this.app.vault.read(prevNote);
		// remove empty and comlete tasks, match unchecked boxes and any bulleted children
    const incompleteTasks = Array.from(contents.replace(/\t*- \[ \][ ]*\n/g, '').replace(/\t*- \[x\] .*\n/g, '').matchAll(/\t*- \[ \].*(\n\t*- .*)*/g)).map(([task]) => task);

		if (incompleteTasks.length == 0) {
			return;
		}

		const todaysNote = await this.app.vault.read(currNote);

		// ignore empty checkboxes
		let updatedNote = todaysNote.replace(/\t*- \[ \][ ]*\n/g, '\n');

		// addContentToHeading returns an empty string if there are no changes
		updatedNote = addContentToHeading(updatedNote, this.settings.taskHeading, incompleteTasks.join('\n'));
		if (!updatedNote) {
			return;
		}

		await this.app.vault.modify(currNote, updatedNote);
	}

	// async runContentCopy (lastNote: TFile, currNote: TFile, srcHeading: string, destHeading: string): Promise<void> {
	async runContentCopy (lastNote: TFile, currNote: TFile, headings: [string, string][]): Promise<void> {
		// copy content from the previous note's source heading to the current note's destination heading
		const prevContents = await this.app.vault.read(lastNote);
		let todaysNote = await this.app.vault.read(currNote);

		headings.forEach(async (pair) => {
			const srcHeading = pair[0];
			const destHeading = pair[1];

			if (!srcHeading || !destHeading) {
				return;
			}

			// find how many hashtags deep the heading is
			const hashLevel = getHashLevel(srcHeading);

			// get content from heading, removing trailing newlines
			const content = prevContents.match(new RegExp("(?<=" + srcHeading + "\n)((?!(\n)+[#]{" + hashLevel + "} .*)(.|\n))*"));
			if (!content) {
				return;
			}

			// addContentToHeading returns an empty string if there are no changes
			const updatedNote = addContentToHeading(todaysNote, destHeading, content[0]);
			if (!updatedNote) {
				return;
			}

			todaysNote = updatedNote;

			await this.app.vault.modify(currNote, todaysNote);
		});
	}
}

class SettingTab extends PluginSettingTab {
	plugin: NoteManager;

	constructor(app: App, plugin: NoteManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'And how would you like that done?'});
		
		/* Previous Note Link */
		await this.previousNoteSettings(containerEl);

		/* Archive */
		await this.archiveSettings(containerEl);

		/* Rollover content from the previous daily note */
		this.containerEl.createEl("h2", { text: "Carryover From Previous Note" });
		// rollover unfinished tasks
		await this.taskSettings(containerEl);
		// Carry over content
		await this.contentCopySettings(containerEl);

		/* Day of the Week */
		await this.daySettings(containerEl);
	}

	// Creates settings UI for archiving notes
	async previousNoteSettings (containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl)
			.setName('Custom Text for Link to Previous Note')
			.setDesc("Include a link to the previous Daily Note using the <#dnm>previous</#dnm> notation in your Daily Note template.")
			.addText((text) => {
				text.setPlaceholder("Example: << Previous")
					.setValue(this.plugin.settings.prevNoteText)
					.onChange(async (prevNoteText) => {
						this.plugin.settings.prevNoteText = prevNoteText;
						await this.plugin.saveSettings();
					});
			});
	}

	// Creates settings UI for archiving notes
	async archiveSettings (containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl)
			.setName('Archive')
			.setDesc("Move old Daily Notes into an 'Archive' folder?")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.archive)
					.onChange(async (archive) => {
						this.plugin.settings.archive = archive;

						await this.plugin.saveSettings();
						this.display();
					});
			});

		if (this.plugin.settings.archive) {
			new Setting(containerEl)
			.setDesc("Max number of previous Daily Notes to remain unarchived:")
			.addText((text) => {
				text.setPlaceholder("Example: 7")
					.setValue(this.plugin.settings.archiveMaxNotes.toString())
					.onChange(async (numNotes) => {
						this.plugin.settings.archiveMaxNotes = parseInt(numNotes);
						await this.plugin.saveSettings();
					});
			});

			new Setting(containerEl)
			.setDesc("Select a folder for your archived Daily Notes.")
			.addSearch((value) => {
				new FolderSelect(this.app, value.inputEl);
				value.setPlaceholder("Example: dir1/subdir1")
					.setValue(this.plugin.settings.archiveFolder)
					.onChange(async (selectedFolder) => {
						this.plugin.settings.archiveFolder = selectedFolder;
						await this.plugin.saveSettings();
					});
			});
		}
	}

	// Creates settings UI for task rollover
	async taskSettings (containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl)
			.setName('Task Rollover')
			.setDesc('Rollover unfinished tasks from the previous Daily Note?')
			.addToggle((toggle) => {
				toggle
				.setValue(this.plugin.settings.taskRollover)
				.onChange(async (taskRollover) => {
					this.plugin.settings.taskRollover = taskRollover;
					await this.plugin.saveSettings();
					this.display();
				})
		});

		if (this.plugin.settings.taskRollover) {
			new Setting(containerEl)
			.setDesc("Select a destination heading for your unfinished tasks.")
			.addSearch((value) => {
				new HeadingSelect(this.app, value.inputEl);
				value.setPlaceholder("Example: ## Tasks")
					.setValue(this.plugin.settings.taskHeading)
					.onChange(async (selectedHeading) => {
						this.plugin.settings.taskHeading = selectedHeading;
						await this.plugin.saveSettings();
					});
			});
		}
	}

	// Creates settings UI for content carryover
	async contentCopySettings (containerEl: HTMLElement): Promise<void> {
		const desc = "Copies over content from a specified heading in the previous Daily Note to a specified heading in today's Daily Note.";
		new Setting(containerEl).setName('Copy Content to New Note').setDesc(desc);

		this.plugin.settings.copyContentHeadings.forEach((headings, index) => {
			const sourceHeading = headings[0];
			const targetHeading = headings[1];

			new Setting(containerEl)
				// .setDesc("From ")
				.addSearch(value => {
					new HeadingSelect(this.app, value.inputEl);
					value.setPlaceholder("Source heading")
					.setValue(sourceHeading)
					.onChange(async (value) => {
						this.plugin.settings.copyContentHeadings[index][0] = value;
						await this.plugin.saveSettings();
					})
				})

				// .setDesc(" -> To ")
				.addSearch(value => {
					new HeadingSelect(this.app, value.inputEl);
					value.setPlaceholder("Target heading")
					.setValue(targetHeading)
					.onChange(async (value) => {
						this.plugin.settings.copyContentHeadings[index][1] = value;
						await this.plugin.saveSettings();
					})
				})

				.addExtraButton((cb) => {
					cb.setIcon("up-chevron-glyph")
						.setTooltip("Move up")
						.onClick(async () => {
							if (index - 1 < 0) return;

							var temp = this.plugin.settings.copyContentHeadings[index];
							this.plugin.settings.copyContentHeadings[index] = this.plugin.settings.copyContentHeadings[index-1];
							this.plugin.settings.copyContentHeadings[index-1] = temp;
						
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((cb) => {
					cb.setIcon("down-chevron-glyph")
						.setTooltip("Move down")
						.onClick(async () => {
							if (index + 1 == this.plugin.settings.copyContentHeadings.length) return;

							var temp = this.plugin.settings.copyContentHeadings[index];
							this.plugin.settings.copyContentHeadings[index] = this.plugin.settings.copyContentHeadings[index+1];
							this.plugin.settings.copyContentHeadings[index+1] = temp;
						
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((cb) => {
					cb.setIcon("cross")
						.setTooltip("Delete")
						.onClick(async () => {
							this.plugin.settings.copyContentHeadings.splice(
								index,
								1
							);

							await this.plugin.saveSettings();
							this.display();
						});
				})
				
				.infoEl.remove();
		})

		new Setting(this.containerEl).addButton((cb) => {
			cb.setButtonText("Create new pair")
				.setCta()
				.onClick(async () => {
					this.plugin.settings.copyContentHeadings.push(["",""]);
					await this.plugin.saveSettings();
					this.display();
				});
		});
	}

	// Creates settings UI for day of the week title
	async daySettings (containerEl: HTMLElement): Promise<void> {
		new Setting(containerEl)
			.setName('Day of the Week')
			.setDesc("Choose custom title for each day of the week?")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.dotw)
					.onChange(async (dotw) => {
						this.plugin.settings.dotw = dotw;

						await this.plugin.saveSettings();
						this.display();
					});
		});

		if (this.plugin.settings.dotw) {
			for (let i = 0; i < 7; i++) {
				new Setting(containerEl)
				.setDesc(DEFAULT_DOTW[i][0])
				.addText((text) => {
					text.setPlaceholder(DEFAULT_DOTW[i][1])
						.setValue(this.plugin.settings.dotwLst[i])
						.onChange(async (input) => {
							this.plugin.settings.dotwLst[i] = input;
							await this.plugin.saveSettings();
						});
				});
			}
		}
	}
}
