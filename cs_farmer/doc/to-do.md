1. Implement a change to the coding box
Each coding box represents a separate saved program with:
- An editable name
- Its own code
- A collapsible editor
- Compile/Run and Stop controls
- A delete button, with confirmation (except the first editor)

Under the default first code editor is
- A plus button to add another program / new coding box
- the plus button is always under the last coding box

All programs would share the same farm state—balance, position, plants, and inventories
A global execution manager stores the currently running program ID. While one program runs, every other Run button is be disabled

The main technical change is that the current editor uses singular DOM elements and state such as #code-editor, #compile-button, and one abort controller
These is be refactored into reusable program/editor components:
Shared farm state
       │
Execution manager — allows one running program
       │
       ├── Program: Harvest wheat
       ├── Program: Buy seeds
       └── Program: Watermelons

Saving is also need an updated save-file version. Instead of one editorCode string, it would contain something like:
{
  "programs": [
    {
      "id": "program-1",
      "name": "Harvest wheat",
      "code": "plant(wheat)\nharvest()",
      "collapsed": false
    }
  ]
}

we are keeping one shared Output panel and including the program name when execution starts
- its under the last coding box that was added
- between the output panel and the coding box is the plus button to add another program / new coding box (add a little text that says "add new editor")

2. update the documentation (some of the last changes might be missing)
- give me a feedback in the chat no need to also write something in this file

