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

// adds given content to a specified heading in a given file. returns empty string if heading could not be found
export function addContentToHeading(note: string, heading: string, content: string): string {
  // number of blank new lines after heading (not including the \n on the heading line)
  const newlinesMatch = ((note || '').match(new RegExp("(?<=" + heading + ")\n*")) || ['']);
  let numNewLines = newlinesMatch[0].length - 1;
  console.log(heading + numNewLines);

  // inserts content under heading, removing up to 1 blank newline
  // So if the template is like so: "## Tasks\n\n## Fun Facts", the updatedNote would look like: "## Tasks\n<content>\n## Fun Facts"
  // console.log(heading);//(?=\n#+ .*)
  // let replaceStr = heading + '\n' + content;
  // if (note.match(new RegExp(heading + "[\n]{0,1}#+"))) {
  //   replaceStr += '\n';
  // }
  // const updatedNote = note.replace(new RegExp(heading + "[\n]{0,2}"), replaceStr);


  // console.log(note.match(new RegExp(heading + "(?=#+|)[\n]{2,}")));
  // let replaceStr = heading + '\n' + content;
  // if (note.match(new RegExp(heading + "(?=#+|)[\n]{2,}"))) {
  //   for (let i = 0; i < numNewLines; i++){
  //     replaceStr += '\n';
  //     console.log(i);
  //   }
  // }
  // else {
  //   replaceStr += '\n\n';
  // }
  // const updatedNote = note.replace(new RegExp(heading + "\n+"), replaceStr);


  // console.log(note.match(new RegExp(heading + "(?=#+|)[\n]{2,}")));


  let replaceStr = heading + '\n' + content;
  if (numNewLines <= 2) {
    replaceStr += '\n\n';
  }
  else {
    for (let i = 0; i < numNewLines; i++){
      replaceStr += '\n';
    }
  }
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

// From Rollover Daily Todos
// export function createRepresentationFromHeadings(headings: string[]) {
//   let i = 0;
//   const tags = [];
//   (function recurse(depth) {
//     let unclosedLi = false;
//     while (i < headings.length) {
//       const [hashes, data] = headings[i].split("# ");
//       if (hashes.length < depth) {
//         break;
//       } else if (hashes.length === depth) {
//         if (unclosedLi) tags.push('</li>');
//         unclosedLi = true;
//         tags.push('<li>', data);
//         i++;
//       } else {
//         tags.push('<ul>');
//         recurse(depth + 1);
//         tags.push('</ul>');
//       }
//     }
//     if (unclosedLi) tags.push('</li>');
//   })(-1);
//   return tags.join('\n');
// }
