# Daily Notes Manager

A Plugin for Obsidian

## Purpose

This plugin is made to handle some automatic Daily Note management for Obsidian.

Unfortunately, this is not meant to offer a wide range of features for people who want to enhance their Daily Note experience. This is simply a result of me wanting very specific functionality and having enough time on my hands to implement it. That being said, feel free to use or modify this code if you find it helpful!

**Note:** There are other plugins that have a lot of the same capabilities, and are more fleshed-out as well. Check out Rollover Daily Todos plugin, for one.

## Features

Some features of this plugin include:
- Insert a link to the previous Daily Note
- An 'Archiving' feature, which automatically moves older Daily Notes to a specified folder
- The ability to rollover unfinished tasks from the previous Daily Note
- The ability to copy specific blocks of content from the previous Daily Note (with the ability to specify 'from'/'to' headings)
- Choose custom top-level headings for each day of the week

### Dynamic Embeddable-Text Syntax
**Note:** You can embed dynamic text in a heading, but that heading will no longer be able to be used as a "source" heading for the Carryover Content feature. The heading WILL still be usable as a "destination" heading for the same feature.

#### Current Date
Insert the note's date anywhere using the syntax `<#dnm>date</#dnm>` in your Daily Note template
- You can modify this by specifying a date format: DD-MM-YYYY, MM-DD, MM-DD-YY, etc.
  - Uses Moment.js to parse dates, so any Moment-compatible date format will work.
- Example: "Current Date: `<#dnm>date:MM-DD-YYYY</#dnm>`"

#### Day of the Week
Insert the current day of the week anywhere using the syntax `<#dnm>dotw</#dnm>` in your Daily Note template
- Example: "It's `<#dnm>dotw</#dnm>`, `<#dnm>date</#dnm>`"

#### Previous Note Link
You can insert a link to your prevous daily note by including `<#dnm>previous</#dnm>` in your daily note template.
In the plugin settings, you can choose a custom text to be displayed in this link.
- The default text is just the previous note's date.
- You can use the "Current Date" and "Day of the Week" embeddable notations to insert the previous note's date and/or day of the week in the link

### Archiving
You can choose to have older notes relocated to an "Archive" folder. When enabled, you can choose a default number of the most recent daily notes to remain unarchived.

**Note:** Internal links to a specific daily note may or may not be updated when note is archived.

### Task Rollover
Unfinished tasks will rollover from the previous Daily Note when enabled. You specify a destination heading from your Daily Note template for tasks to be inserted under.
Empty and completed tasks are ignored. All unchecked checkboxes from the previous note, regardless of location or heading, will be copied.

### Content Carryover
You can select "Source" (from previous note) and "Destination" (to current note) headings for Content Carryover.
All content and subheadings under the source heading will be copied to the destination heading exactly as-is.

### Day of the Week
You can choose to give your Daily Note a different custom top-level heading for each day of the week.

In the text field for your custom heading (in plugin settings), use the embeddable-date syntax (`<#dnm>date</#dnm>`) to use the note's date in the heading.
- Example: "It's Friday, `<#dnm>date:MM-DD</#dnm>`"
- Read more in the [[### Dynamic Embeddable-Text Syntax]] section.

#### custom-dotw Syntax
By default, this title is added to the beginning of the file as a top-level heading, followed by a newline character. However, you have the option to select where you want this text to appear, with any number of headings using the embeddable syntax `<#dnm>custom-dotw</#dnm>`. If this appears anywhere in your Daily Note template, the Day of the Week feature will replace this embeddable with your custom text rather than creating a new title at the top of the file.

**Note:** Using the custom-dotw syntax will replace the embeddable text with the custom text, without adding hashtags or newlines.
- So if you want it to be a second-level heading, you need to use: `## <#dnm>custom-dotw</#dnm>`
- Any newlines after your custom-dotw embeddable will persist, but no additional newlines will be created.
  - e.g., `## <#dnm>custom-dotw</#dnm> Blahblahblah` might translate to `## It's Friday! Blahblahblah`

## Using this Plugin

Download the latest release, and move the folder to the `.obsidian/plugins/` directory in your Obsidian Vault

Enable this plugin in 'Settings > Options > Community Plugins' in your Vault

Configure in 'Settings > Community Plugins > Daily Notes Manager'
