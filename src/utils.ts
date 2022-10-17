import { TFile, TFolder } from "obsidian";
import { getDailyNote, getDailyNoteSettings, getAllDailyNotes } from "obsidian-daily-notes-interface";

export function fuzzySearch (name: string, input: string): boolean {
  name = name.toLowerCase();
  input = input.toLowerCase();

  let l;
  for (let i = 0, n = -1; l = input[i++];) {
    // ~0 = -1, ~-1 = 0; !0 = true; !~(-1) = true
    if (!~(n = name.indexOf(l, n + 1))) {
      return false;
    }
  }
  return true;
}

export function getDailyNoteFolder (): string {
  const fPath = getDailyNoteSettings().folder;
  if (!fPath) return '';

  const folder = this.app.vault.getAbstractFileByPath(fPath);
  if (!folder || !(folder instanceof TFolder)) return '';

  return folder.path
}

export function isDailyNote (file: TFile | undefined = undefined, todaysOnly: boolean = false): boolean {
  file = file ?? getDailyNote(window.moment(), getAllDailyNotes())

  if (!file) {
    return false;
  }

  if (!file.path.startsWith(this.getDailyNoteFolder())) {
    return false;
  }

  if (!todaysOnly) {
    return true;
  }

  if (file.basename == window.moment(new Date()).format(getDailyNoteSettings().format)){
    return true;
  }

  return false;
}
