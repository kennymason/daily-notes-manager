import { TAbstractFile, TFolder, TFile } from "obsidian";
import { getDailyNoteSettings } from 'obsidian-daily-notes-interface'
import { TextInputSuggest } from "./suggest";
import { fuzzySearch } from "../utils";

export class FolderSelect extends TextInputSuggest<TFolder> {
  findFolders (input: string): TFolder[] {
    const allFiles: TAbstractFile[] = app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    allFiles.forEach((file: TAbstractFile) => {
      if (file instanceof TFolder && fuzzySearch(file.path, input)) {
        folders.push(file);
      }
    });
    return folders;
  }

  async getSuggestions(inputStr: string): Promise<TFolder[]> {
    return this.findFolders(inputStr);
  }

  renderSuggestion(item: TFolder, el: HTMLElement): void {
    el.setText(item.path);
  }

  selectSuggestion(item: TFolder): void {
    this.inputEl.value = item.path
    this.inputEl.trigger("input");
    this.close();
  }
}

export class HeadingSelect extends TextInputSuggest<string> {
  async getDailyNoteHeadings (): Promise<string[]> {
    const tPath = getDailyNoteSettings().template;
    if (!tPath) return [];

    const tFile = this.app.vault.getAbstractFileByPath(tPath) ?? this.app.vault.getAbstractFileByPath(tPath + '.md');
    if (!tFile || !(tFile instanceof TFile)) return [];

    const template = await this.app.vault.read(tFile);
    return Array.from(template.matchAll(/#{1,} .*/g)).map(([heading]) => heading);
  }

  async findHeadings (input: string): Promise<string[]> {
    let headings: string[] = [];
    const allHeadings: string[] = await this.getDailyNoteHeadings();

    allHeadings.forEach((heading: string) => {
      if (fuzzySearch(heading, input)) {
        headings.push(heading);
      }
    });

    return headings;
  }

  async getSuggestions(inputStr: string): Promise<string[]> {
    return this.findHeadings(inputStr);
  }

  renderSuggestion(item: string, el: HTMLElement): void {
    el.setText(item);
  }

  selectSuggestion(item: string): void {
    this.inputEl.value = item;
    this.inputEl.trigger("input");
    this.close();
  }
}
