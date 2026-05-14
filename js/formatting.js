export function applyFormatting(format) {
  const textarea = document.getElementById('note-body');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);

  let formattedText = selectedText;
  switch (format) {
    case 'highlight':
      formattedText = `<mark>${selectedText}</mark>`;
      break;
    case 'bold':
      formattedText = `**${selectedText}**`;
      break;
    case 'underline':
      formattedText = `<u>${selectedText}</u>`;
      break;
    case 'code':
      formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
      break;
  }

  textarea.setRangeText(formattedText, start, end, 'end');
}
