---
id: form
title: Form
sidebar_label: Form
---

`Form` reads the values of a form and locks its controls. It follows what the browser would submit: disabled controls,
unchecked checkboxes and radio buttons, and buttons are left out.

```javascript
import Form from 'bigpipe-util/dist/core/Form';

Form.serialize(form);                // { title: 'Hello', tags: ['a', 'b'], user: { name: 'Jo' } }
Form.serialize(form, submitButton);  // with the name and value of the button that submitted it
Form.createFormData(form, submitButton);
Form.hasFiles(form);                 // whether a file is chosen
Form.setDisabled(form, true);        // disable every control, and later enable the same ones
Form.focusFirst(form);               // the first field, else the first button
```

## serialize

Fields named `a[b]` become objects and fields named `a[]` become arrays, the way PHP reads them, so what you send
with [`AsyncRequest`](async_request.md) matches `$_POST`. A repeated plain name keeps its last value, as in PHP. Files are
not part of the result: use `createFormData()` for them.

```javascript
// <input name="tags[]" value="a"> <input name="tags[]" value="b"> <input name="user[name]" value="Jo">
Form.serialize(form); // { tags: ['a', 'b'], user: { name: 'Jo' } }
```

## setDisabled

`Form.setDisabled(form, true)` disables the controls and remembers which ones were disabled already. `false` enables
only the controls it disabled itself, so a control that was disabled for another reason stays disabled. It accepts any
element that holds controls, not only forms. A control that is disabled is not part of what is submitted, so read the
values first. The [Primer](primer.md) makes the controls of an async form read-only instead while it is saving, which
keeps them in the tab order.
