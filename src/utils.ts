import moment from 'moment';
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

export function getHashLevel (headingStr: string): number {
  let hashLevel = 0;
  for (; hashLevel < headingStr.length; hashLevel++) {
    if (headingStr[hashLevel] != '#') {
      break;
    }
  }

  return hashLevel
}

export function parseEmbeddables (str: string, date: string): string {
  str = parseDotwEmbeddable(str, date);
  str = parseDateEmbeddable(str, date);
  return str;
}

export function parseDateEmbeddable (str: string, date: string): string {
  // Replace unmodified dates
  str = str.replace("<#dnm>date<\/#dnm>", date);

  // replace dates with modifiers
  let re = new RegExp("<#dnm>date[:]?(.*?)<\/#dnm>", 'g');
  var match;
  while (match = re.exec(str)) {
    // get format modifier
    if (match[1]) {
      str = str.replace(match[0], moment(date).format(match[1]));
    }
  }

  return str;
}

export function parseDotwEmbeddable (str: string, date: string): string {
  const day = getDayOfTheWeek(date);
  if (day == -1) {
    return str;
  }

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  
  return str.replace(new RegExp("<#dnm>dotw</#dnm>", 'g'), days[day]);
}

export function getDayOfTheWeek (date: string): number {
  const day = new Date(date.replace('-', '/')).getDay();
  if (day < 0 || day > 6) return -1;

  return day;
}

// adds given content to a specified heading in a given file. returns empty string if heading could not be found
export function addContentToHeading (note: string, heading: string, content: string): string {
  // number of blank new lines after heading (not including the \n on the heading line)
  const newlinesMatch = ((note || '').match(new RegExp("(?<=" + heading + ")\n*")) || ['']);
  let numNewLines = newlinesMatch[0].length - 1;
  
  // add newlines after content. if the template has <= 2 newlines under the heading, add 2 newlines
  // otherwise, keep the number of newlines the template has (-1, because the first blank line becomes the content line)
  let replaceStr = heading + '\n' + content;
  if (numNewLines <= 2) {
    replaceStr += '\n\n';
  }
  else {
    for (let i = 0; i < numNewLines; i++){
      replaceStr += '\n';
    }
  }

  // Add content to note
  const updatedNote = note.replace(new RegExp(heading + "\n*"), replaceStr);

  if (updatedNote == note) {
    return '';
  }

  return updatedNote;
}

export function getDailyNoteFolder (): string {
  const fPath = getDailyNoteSettings().folder;
  if (!fPath) return '';

  const folder = this.app.vault.getAbstractFileByPath(fPath);
  if (!folder || !(folder instanceof TFolder)) return '';

  return folder.path
}

export function getDailyNoteByPartialKey (allNotes: Record<string, TFile>, allKeys: string[], key: string): TFile | undefined {
  for (const fullKey in allKeys) {
    if (key == fullKey.replace('day-', '').replace('month-', '').replace('year-', '')){
      //move file allNotes[fullKey] to this.settings.archiveFolder
      return allNotes[fullKey];
    }
  }

  return undefined;
}

export function isDailyNote (file: TFile | undefined = undefined, todaysOnly: boolean = false): boolean {
  file = file ?? getDailyNote(window.moment(), getAllDailyNotes())

  if (!file) {
    return false;
  }

  if (!file.path.startsWith(getDailyNoteFolder())) {
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
