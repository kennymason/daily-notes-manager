import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { getAllDailyNotes } from 'obsidian-daily-notes-interface';
import { fileURLToPath } from 'url';
import { FolderSelect, HeadingSelect } from './Settings/Selecters';
import { getDailyNoteFolder, isDailyNote } from './utils';

// Remember to rename these classes and interfaces!

interface Settings {
	mySetting: string;
	noteFolder: string,
	archive: boolean,
	archiveMaxNotes: number,
	archiveFolder: string,
	taskRollover: boolean,
	copyContentHeadings: Array<[string, string]>
}

const DEFAULT_SETTINGS: Settings = {
	mySetting: 'default',
	noteFolder: '',
	archive: false,
	archiveMaxNotes: 7,
	archiveFolder: '',
	taskRollover: true,
	copyContentHeadings: [["", ""]]
}

export default class NoteManager extends Plugin {
	settings: Settings;

	async onload() {
		await this.loadSettings();

		this.registerEvent(this.app.vault.on('create', async (file) => {
      if (!(file instanceof TFile && isDailyNote(file))) {
				return;
			}

			// TODO

			// Get Last Daily Note

			if (this.settings.archive) {
				const allNotes = getAllDailyNotes();

				if (Object.keys(allNotes).length > 7) {
					// archive oldest notes
				}


			} 
			
			/*
			*/
    }))

		//TODO
		/*
		function getDailyNote (): TFile {
			// let file = findDailyNote(); // looks for existing daily note

			// if (!file || !isDailyNote(file, true)) file = createDailyNote();

			return file;
		}
		*/

		// creates the icon in the left ribbon
		const ribbonIconEl = this.addRibbonIcon('dice', 'Daily Notes Manager', (evt: MouseEvent) => {
			// Called when the user clicks the icon.

			// TODO
			//const todaysNote = getDailyNote();
			// what do i do if it exists? what if i have to create it?

			new Notice('Created Daily Note!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
							.setValue(this.plugin.settings.archiveFolder)
							.onChange(async (numNotes) => {
									this.plugin.settings.archiveMaxNotes = numNotes;
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
				})
		});

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
