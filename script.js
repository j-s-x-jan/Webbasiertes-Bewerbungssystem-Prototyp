document.addEventListener('DOMContentLoaded', () => {

  const form = document.querySelector('form');
  if (!form) return;

  const formView = document.getElementById('form-view');
  const confirmView = document.getElementById('confirm-view');
  const successView = document.getElementById('success-view');

  const confirmBackBtn = document.getElementById('confirm-back-btn');
  const confirmSubmitBtn = document.getElementById('confirm-submit-btn');

  const errorBox = document.querySelector('.error-box');

  const storageKey = 'bewerbungssystem-draft-v1';

  const extraFilesContainer = document.getElementById('extra-files-container');
  const addFileButton = document.getElementById('add-file-btn');

  const discardToast = document.getElementById('discard-toast');

  const discardView = document.getElementById('discard-view');
  const discardBackBtn = document.getElementById('discard-back-btn');
  const discardConfirmBtn = document.getElementById('discard-confirm-btn');

  const cancelButton = Array
    .from(form.querySelectorAll('button'))
    .find((btn) => btn.textContent.trim() === 'Entwurf verwerfen');

  let formSubmitted = false;
  let extraFileCounter = 0;
  let saveTimer = null;

  function showBox(box, text) {
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
  }

  function hideBox(box) {
    if (!box) return;
    box.hidden = true;
  }

  function clearAllBoxes() {
    hideBox(errorBox);
  }

  function formatFileSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb < 1 ? 2 : 1)} MB`;
  }

  function isPdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  function isImage(file) {
    return file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);
  }

  function getAllFields() {
    return Array.from(form.querySelectorAll('input, select, textarea'));
  }

  function getUploadStatusBox(input) {
    const uploadBox = input.closest('.upload-box');
    return uploadBox
      ? uploadBox.querySelector('.upload-status')
      : null;
  }

  function updateUploadStatus(input, message = '') {

    const statusBox = getUploadStatusBox(input);
    if (!statusBox) return;

    const files = Array.from(input.files || []);

    if (message) {
      statusBox.textContent = `Upload-Status: ${message}`;
      return;
    }

    if (!files.length) {
      statusBox.textContent =
        'Upload-Status: keine Datei ausgewählt';
      return;
    }

    if (files.length === 1) {
      statusBox.textContent =
        `Upload-Status: ${files[0].name} (${formatFileSize(files[0].size)})`;
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    statusBox.textContent =
      `Upload-Status: ${files.length} Dateien ausgewählt (${formatFileSize(totalSize)})`;
  }

  function getFeedbackBox(field) {

    const container =
      field.closest('.field') || field.parentElement;

    if (!container) return null;

    let feedback = container.querySelector('.js-field-error');

    if (!feedback) {

      feedback = document.createElement('div');

      feedback.className = 'js-field-error';

      feedback.setAttribute('aria-live', 'polite');

      field.insertAdjacentElement('afterend', feedback);
    }

    return feedback;
  }

  function isExtraFileInput(field) {
    return field.dataset.extraFile === 'true';
  }

  function getCustomMessage(field) {

    if (field.type === 'file') {

      const files = Array.from(field.files || []);
      const maxBytes = 10 * 1024 * 1024;

      if (field.required && files.length === 0) {
        return 'Bitte wähle eine Datei aus.';
      }

      for (const file of files) {
        if (file.size > maxBytes) {
          return `Die Datei ${file.name} ist größer als 10 MB.`;
        }
      }

      if (
        (field.id === 'lebenslauf' ||
          field.id === 'motivationsschreiben')
        && files.length > 0
      ) {
        if (!isPdf(files[0])) {
          return 'Bitte lade eine PDF-Datei hoch.';
        }
      }

      if (isExtraFileInput(field) && files.length > 0) {

        const invalidFile =
          files.find((file) =>
            !(isPdf(file) || isImage(file))
          );

        if (invalidFile) {
          return 'Erlaubt sind PDF-, JPG- oder PNG-Dateien.';
        }
      }

      return '';
    }

    if (field.validity.valueMissing) {

      if (field.id === 'datenschutz') {
        return 'Bitte bestätigen Sie die Datenschutzhinweise.';
      }

      return 'Dieses Feld muss ausgefüllt werden.';
    }

    if (
      field.validity.typeMismatch &&
      field.type === 'email'
    ) {
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    }

    if (
      field.validity.patternMismatch &&
      field.id === 'plz'
    ) {
      return 'Die Postleitzahl muss aus 5 Ziffern bestehen.';
    }

    return '';
  }

  function syncFieldState(field) {

    const message = getCustomMessage(field);

    field.setCustomValidity(message);

    const feedbackBox = getFeedbackBox(field);

    const hasError = Boolean(message);

    field.classList.toggle(
      'is-invalid',
      hasError && formSubmitted
    );

    field.toggleAttribute(
      'aria-invalid',
      hasError && formSubmitted
    );

    if (feedbackBox) {

      if (hasError && formSubmitted) {
        feedbackBox.textContent = message;
      } else if (!hasError) {
        feedbackBox.remove();
      } else {
        feedbackBox.textContent = '';
      }
    }

    if (field.type === 'file') {
      updateUploadStatus(field, message);
    }

    return !hasError;
  }

  function syncAllFields() {
    return getAllFields().every((field) =>
      syncFieldState(field)
    );
  }

  function collectDraft() {

    const draft = {};

    getAllFields().forEach((field) => {

      if (field.type === 'file') return;

      if (field.type === 'checkbox') {
        draft[field.id] = field.checked;
      } else {
        draft[field.id] = field.value;
      }
    });

    return draft;
  }

  function saveDraft() {

    try {

      localStorage.setItem(
        storageKey,
        JSON.stringify(collectDraft())
      );

    } catch (error) {
      console.error(error);
    }
  }

  function restoreDraft() {

    const rawDraft =
      localStorage.getItem(storageKey);

    if (!rawDraft) return;

    try {

      const draft = JSON.parse(rawDraft);

      Object.entries(draft).forEach(([id, value]) => {

        const field =
          document.getElementById(id);

        if (!field || field.type === 'file') return;

        if (field.type === 'checkbox') {
          field.checked = Boolean(value);
        } else {
          field.value = value ?? '';
        }
      });

    } catch (error) {
      console.error(error);
    }
  }

  function createExtraFileEntry() {

    extraFileCounter += 1;

    const wrapper = document.createElement('div');

    wrapper.className = 'upload-entry';

    wrapper.innerHTML = `
          <div class="upload-box">

            <div class="upload-entry-header">
              <strong>Zusatzdatei</strong>

              <button
                type="button"
                class="btn btn-link remove-file-btn">
                Entfernen
              </button>
            </div>

            <input
              type="file"
              name="extraFiles[]"
              accept="application/pdf,image/*"
              data-extra-file="true" />

            <div class="hint">
              Erlaubt: PDF, JPG, PNG. Maximal 10 MB.
            </div>

            <div class="upload-status" aria-live="polite">
              Upload-Status: keine Datei ausgewählt
            </div>

          </div>
        `;

    const input = wrapper.querySelector('input');

    const removeButton =
      wrapper.querySelector('.remove-file-btn');

    input.addEventListener('change', () => {
      syncFieldState(input);
    });

    removeButton.addEventListener('click', () => {
      wrapper.remove();
    });

    extraFilesContainer.appendChild(wrapper);
  }

  getAllFields().forEach((field) => {

    const eventName =
      field.type === 'file' ||
        field.tagName === 'SELECT'
        ? 'change'
        : 'input';

    field.addEventListener(eventName, () => {

      syncFieldState(field);

      clearAllBoxes();

      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }

      saveTimer = window.setTimeout(() => {
        saveDraft();
      }, 400);
    });

    field.addEventListener('blur', () => {
      syncFieldState(field);
    });
  });

  form.addEventListener('invalid', (event) => {

    event.preventDefault();

    syncFieldState(event.target);

    clearAllBoxes();

  }, true);

  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      formView.hidden = true;
      confirmView.hidden = true;
      successView.hidden = true;

      if (discardView) {
        discardView.hidden = false;
        discardConfirmBtn?.focus({ preventScroll: true });
      }
    });
  }

  if (discardBackBtn) {
    discardBackBtn.addEventListener('click', () => {
      if (discardView) discardView.hidden = true;
      formView.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (discardConfirmBtn) {
    discardConfirmBtn.addEventListener('click', () => {
      formSubmitted = false;
      form.reset();

      extraFilesContainer.innerHTML = '';
      extraFileCounter = 0;
      createExtraFileEntry();

      localStorage.removeItem(storageKey);

      getAllFields().forEach((field) => {
        field.setCustomValidity('');
        field.classList.remove('is-invalid');
        field.removeAttribute('aria-invalid');

        const feedbackBox = field.closest('.field')?.querySelector('.js-field-error');
        if (feedbackBox) feedbackBox.remove();

        if (field.type === 'file') {
          updateUploadStatus(field);
        }
      });

      if (discardView) discardView.hidden = true;
      formView.hidden = false;
      confirmView.hidden = true;
      successView.hidden = true;
      clearAllBoxes();

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (discardToast) {
        window.setTimeout(() => {
          showBox(discardToast, 'Alle Eingaben wurden erfolgreich verworfen.');
          window.setTimeout(() => hideBox(discardToast), 3000);
        }, 350);
      }
    });
  }

  if (addFileButton) {

    addFileButton.addEventListener('click', () => {
      createExtraFileEntry();
    });
  }

  form.addEventListener('submit', (event) => {

    event.preventDefault();

    formSubmitted = true;

    clearAllBoxes();

    const validSync = syncAllFields();
    const nativeValid = form.checkValidity();

    if (!validSync || !nativeValid) {

      const invalidFields = getAllFields().filter((field) => !field.checkValidity());
      const count = invalidFields.length;

      showBox(
        errorBox,
        `Die Bewerbung konnte nicht gesendet werden. ${count} Pflichtfeld${count === 1 ? '' : 'er'} ${count === 1 ? 'ist' : 'sind'} nicht ausgefüllt.`
      );

      const firstInvalid = invalidFields[0];

      if (firstInvalid) {

        firstInvalid.focus({
          preventScroll: true
        });

        firstInvalid.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }

      return;
    }

    formView.hidden = true;
    confirmView.hidden = false;

    confirmSubmitBtn?.focus({
      preventScroll: true
    });
  });

  if (confirmBackBtn) {

    confirmBackBtn.addEventListener('click', () => {

      confirmView.hidden = true;
      formView.hidden = false;

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  if (confirmSubmitBtn) {

    confirmSubmitBtn.addEventListener('click', () => {

      saveDraft();

      formView.hidden = true;
      confirmView.hidden = true;
      successView.hidden = false;

      localStorage.removeItem(storageKey);

      successView.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }

  restoreDraft();

  getAllFields().forEach((field) => {
    syncFieldState(field);
  });

  createExtraFileEntry();
});