import { App, Editor, FileManager, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { createDailyNote, getAllDailyNotes, getDailyNote, getDailyNoteSettings } from 'obsidian-daily-notes-interface';
import { fileURLToPath } from 'url';
import { FolderSelect, HeadingSelect } from './Settings/Selecters';
import { getDailyNoteFolder, getDailyNoteByPartialKey, isDailyNote, addContentToHeading, getHashLevel } from './utils';

// Remember to rename these classes and interfaces!

interface Settings {
	mySetting: string;
	noteFolder: string,
	archive: boolean,
	archiveMaxNotes: number,
	archiveFolder: string,
	taskRollover: boolean,
	taskHeading: string,
	copyContentHeadings: Array<[string, string]>,
	modified: {
		[key: string]: string
	}
}

const DEFAULT_SETTINGS: Settings = {
	mySetting: 'default',
	noteFolder: '',
	archive: false,
	archiveMaxNotes: 7,
	archiveFolder: '',
	taskRollover: true,
	taskHeading: '',
	copyContentHeadings: [["", ""]],
	modified: {
		curr: '',
		prev: ''
	}
}

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
			if (!(file instanceof TFile)) {
				return;
			}
			await this.runNoteManager(file);
		}));

		this.registerEvent(this.app.vault.on('delete', async (file) => {
			if (!(file instanceof TFile)) {
				return;
			}

			// remove note from modified log
			if (this.settings.modified.prev == file.basename){
				this.settings.modified.prev = '';

				await this.saveSettings();
			}
			if (this.settings.modified.curr == file.basename){
				this.settings.modified.curr = this.settings.modified.prev;

				await this.saveSettings();
			}
		}));

    this.addCommand({
      id: "run-daily-notes-manager",
      name: "Run Daily Notes Manager",
      callback: async () => {
				const file = await createDailyNote(window.moment());
				await this.runNoteManager(file);
			}
    })

		// creates the icon in the left ribbon
		const ribbonIconEl = this.addRibbonIcon('dice', 'Daily Notes Manager', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			let todaysNote = getDailyNote(window.moment(), getAllDailyNotes());

			if (!isDailyNote(todaysNote, true)) {
				todaysNote = await createDailyNote(window.moment());
				await this.runNoteManager(todaysNote);
			}
			// TODO: use the daily note settings format in other places
			else {
				if (todaysNote.basename != this.settings.modified.curr && todaysNote.basename != this.settings.modified.prev) {
					await this.runNoteManager(todaysNote);
				}
			}

			const leaf = this.app.workspace.getLeaf();
			leaf.openFile(todaysNote);

			// new Notice('Created Daily Note!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// add a settings tab
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {

	}

	async runNoteManager (file: TFile | null): Promise<void> {
		if (!file || !(file instanceof TFile) || !isDailyNote(file)) {
			return;
		}
			
		// if (this.settings.modified.curr == file.basename){
		// 	if (this.settings.modified.prev == file.basename){
		// 		this.settings.modified.curr = '';
		// 		this.settings.modified.prev = '';
		// 	}
		// 	else {
		// 		this.settings.modified.curr = this.settings.modified.prev;
		// 	}

		// 	await this.saveSettings();
		// }


		// return if this note was already modified
		if (this.settings.modified.prev == file.basename || this.settings.modified.curr == file.basename){
			return;
		}
		
		// mark note as modified
		this.settings.modified.prev = this.settings.modified.curr;
		this.settings.modified.curr = file.basename;
		await this.saveSettings();
		// // return if this note was already modified
		// const x = new Date(this.settings.modified)
		// const y = new Date(file.basename);
		// if ((x ? x.getTime() : 0) - (y ? y.getTime() : 0) > 0) {
		// 	return;
		// }

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
			this.settings.copyContentHeadings.forEach(async (pair) => {
				await this.runContentCopy(lastNote, file, pair[0], pair[1]);
			});
		}
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
    const incompleteTasks = Array.from(contents.replace(/\t*- \[ \][ ]*\n/g, '').matchAll(/\t*- \[ \].*/g)).map(([task]) => {
			if (!task.match(/\t*- \[ \][ ]*\n/)) return task;
		});

		if (incompleteTasks.length == 0) {
			return;
		}

		const todaysNote = await this.app.vault.read(currNote);

		// const blankCheckboxRegex = new RegExp("\t*- \[ \][ ]*\n", 'g');
		let updatedNote = todaysNote.replace(/\t*- \[ \][ ]*\n/g, '');

		if (updatedNote != todaysNote) console.log("not");
		if (updatedNote == todaysNote) console.log("is");

		updatedNote = addContentToHeading(updatedNote, this.settings.taskHeading, incompleteTasks.join('\n'));

		if (!updatedNote) {
			return;
		}

		await this.app.vault.modify(currNote, updatedNote);
	}

	async runContentCopy (lastNote: TFile, currNote: TFile, srcHeading: string, destHeading: string): Promise<void> {
		// copy content from the previous note's source heading to the current note's destination heading
		const contents = await this.app.vault.read(lastNote);

    // Array.from(contents.matchAll(new RegExp(srcHeading, 'g'))).map(([heading]) => heading);

		const hashLevel = getHashLevel(srcHeading);

		// const hashRegex = "#{" + hashLevel + "} .*"
    // const headings = Array.from(contents.matchAll(new RegExp(hashRegex, 'g'))).map(([heading]) => heading);
		console.log(new RegExp("(?<=" + srcHeading + ")[\n.]*(?=\n[#]{" + hashLevel + "} .*)"));
		const content = contents.match(new RegExp("(?<=" + srcHeading + ")[\n.]*(?=\n[#]{" + hashLevel + "} .*)"));
		if (!content) {
			console.log("nocnt");
			return;
		}

		const todaysNote = await this.app.vault.read(currNote);

		const updatedNote = addContentToHeading(todaysNote, destHeading, content.join('\n'));
		if (!updatedNote) {
			console.log("noupdates");
			return;
		}
		console.log("woop");

		await this.app.vault.modify(currNote, updatedNote);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: NoteManager;

	constructor(app: App, plugin: NoteManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		/* Daily Notes Folder */
		const noteFolder = getDailyNoteFolder();
		if (noteFolder) this.plugin.settings.noteFolder = noteFolder;
		// new Setting(containerEl)
		// .setName("Daily Notes folder location")
		// .setDesc("Select the folder where you create new Daily Notes.")
		// .addSearch((value) => {
		// 		new FolderSelect(this.app, value.inputEl);
		// 		value.setPlaceholder("Example: dir1/subdir1")
		// 				.setValue(this.plugin.settings.noteFolder)
		// 				.onChange(async (selectedFolder) => {
		// 						this.plugin.settings.noteFolder = selectedFolder;
		// 						await this.plugin.saveSettings();
		// 				});
		// 		// @ts-ignore
		// 		value.containerEl.addClass("templater_search"); //TODO
		// });
		
		/* Archive */
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
					// @ts-ignore
					value.containerEl.addClass("templater_search");
			});
		}

		/* Rollover content from the previous daily note */
		this.containerEl.createEl("h2", { text: "Carryover From Previous Note" });

		// rollover unfinished tasks
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
					// @ts-ignore
					value.containerEl.addClass("templater_search"); //TODO
			});
		}

		// Carry over content
		// const desc = document.createDocumentFragment();
		// desc.append(
		// 		"Copies over content from a specified heading in the previous Daily Note to a specified heading in today's Daily Note."
		// );
		const desc = "Copies over content from a specified heading in the previous Daily Note to a specified heading in today's Daily Note.";
		new Setting(this.containerEl).setName('Copy Content to New Note').setDesc(desc);

		this.plugin.settings.copyContentHeadings.forEach((headings, index) => {
			const sourceHeading = headings[0];
			const targetHeading = headings[1];

			new Setting(containerEl)
				.addSearch(value => {
					new HeadingSelect(this.app, value.inputEl);
					value.setPlaceholder("Source heading")
					.setValue(sourceHeading)
					.onChange(async (value) => {
						this.plugin.settings.copyContentHeadings[index][0] = value;
						await this.plugin.saveSettings();
					})
				})

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
										// Force refresh
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
							// Force refresh
							this.display();
					});
			});
	}
}
