// Use the shipped options page's controls with an isolated, temporary install.
export async function checkSettings(openOptions, until, check, upgrade) {
  async function open() {
    const evaluate = await openOptions();
    await until(
      () =>
        evaluate(
          "document.querySelector('.ci-category select:enabled') !== null",
        ),
      'local category settings',
    );
    return evaluate;
  }
  const selection = "document.querySelector('.ci-category select').value";
  let evaluate = await open();
  check(
    'default category shows normally',
    (await evaluate(selection)) === 'show',
  );
  check(
    'credential entry is unavailable in the development build',
    !(await evaluate(
      "document.querySelector('input[type=password]:enabled') !== null",
    )),
  );
  await evaluate(`(() => {
    const select = document.querySelector('.ci-category select');
    select.value = 'hide';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await until(
    () =>
      evaluate(
        "document.querySelector('.ci-category').closest('form').querySelector('button[type=submit]:enabled') !== null",
      ),
    'save available',
  );
  await evaluate(
    "document.querySelector('.ci-category').closest('form').requestSubmit()",
  );
  await until(
    () =>
      evaluate(
        "document.querySelector('.ci-feedback')?.textContent.includes('saved')",
      ),
    'settings saved',
  );
  evaluate = await open();
  check(
    'saved rule survives reopening settings',
    (await evaluate(selection)) === 'hide',
  );
  if (upgrade) {
    await upgrade();
    evaluate = await open();
    check(
      'saved rule survives same-ID higher-version update',
      (await evaluate(selection)) === 'hide',
    );
  }
  const dataSection =
    "document.getElementById('data-title').closest('section')";
  await evaluate(
    `${dataSection}.querySelector('input[type=checkbox]').click()`,
  );
  await until(
    () =>
      evaluate(
        `${dataSection}.querySelector('button.ci-danger:enabled') !== null`,
      ),
    'clear confirmed',
  );
  await evaluate(`${dataSection}.querySelector('button.ci-danger').click()`);
  await until(
    () =>
      evaluate(
        "document.querySelector('.ci-feedback')?.textContent.includes('cleared')",
      ),
    'settings cleared',
  );
  evaluate = await open();
  check(
    'confirmed reset persists across reopening',
    (await evaluate(selection)) === 'show',
  );
}
