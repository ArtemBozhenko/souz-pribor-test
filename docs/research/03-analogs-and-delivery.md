# 03. Аналоги, стек, удобство для контент-менеджера, подача

Дата: 2026-11-02. Контекст: тестовое задание Союз-Прибор (`docs/task.md`). Это локальный прототип, который по данным о КИП-приборе делает через LLM черновик карточки для B2B-магазина.

Принятые обозначения: **[факт]** взят из источника по ссылке, **[вывод]** — наша интерпретация.

---

## 1. Существующие решения и open-source аналоги

### 1.1 Крупные площадки: как устроен пайплайн

**Amazon (генерация листингов для продавцов)**
- [факт] С 2024 года продавец даёт URL, фото или таблицу, система собирает черновик листинга с заголовком, описанием и атрибутами и отдаёт его продавцу на «approve or edit». Сервисом воспользовались более 900 тыс. продавцов, почти 80% черновиков принимаются с минимальными правками. https://aws.amazon.com/blogs/machine-learning/going-beyond-ai-assistants-examples-from-amazon-com-reinventing-industries-with-generative-ai/
- [факт] Там же: одна LLM генерирует атрибуты, другая их валидирует («dual-LLM approach helps prevent hallucinations, which is critical when dealing with safety hazards or technical specifications»). Не прошедшие проверку листинги генерируются заново. Описан типичный сбой: модель путает смысл атрибута, например «capacity» у подставки для ножей принимает за габариты, а не за число слотов.
- [факт] Amazon Science, статья о детекции галлюцинаций в LLM-обогащённых листингах. Галлюцинация там определена как «content that is unfaithful to the source input». Детекция идёт в две фазы: сначала дешёвые методы ради полноты (recall), затем LLM подтверждает кандидатов ради точности (precision). На **структурированных** атрибутах, где галлюцинация определена чётко, качество выше целевого. На неструктурированных мешают неоднозначность и «здравый смысл». https://www.amazon.science/publications/hallucination-detection-in-llm-enriched-product-listings
- [факт] Prompt tuning для атрибутов: в промпт кладут правило «The values returned must match the granularity… of the values in the candidate list», чтобы модель не огрубляла «440 stainless steel» до «stainless steel». Модель также просят объяснять ответ, так качество выше. https://www.amazon.science/blog/using-llms-to-improve-amazon-product-listings
- [факт] Каталог Amazon в 2026 году: несколько небольших моделей обрабатывают один товар, совпадение ответов считается сигналом доверия. При расхождении товар уходит к «supervisor»-модели. https://aws.amazon.com/blogs/machine-learning/how-the-amazon-com-catalog-team-built-self-learning-generative-ai-at-scale-with-amazon-bedrock/

**Shopify Magic / Sidekick**
- [факт] Главный продуктовый принцип при запуске AI-описаний: «let the merchant decide». Продавец сам решает, принимать ли предложение AI. https://creatoreconomy.so/p/how-shopify-built-generative-ai
- [факт] В справке Shopify прямо предупреждают: сгенерированный текст может содержать выгоды, которых продавец не указывал, и «facts based on other published content related to similar products». Минимум на входе: название и 2 характеристики. https://help.shopify.com/en/manual/products/details/product-descriptions/generate
- [вывод] Это ровно тот failure mode, от которого требует защититься наше ТЗ: модель переносит «типичные» характеристики похожих товаров.

**Яндекс Маркет (YandexGPT в кабинете продавца)**
- [факт] Описание генерируется из уже заполненных характеристик. Промпт составлен так, чтобы «не давать модели придумывать несуществующие характеристики». Сначала ошибки были в 33–35 текстах из 100, после дообучения 88 из 100 проходят без ошибок. Продавцы используют 52% сгенерированных описаний. https://yandex.cloud/ru/cases/yandex-market
- [факт] Продавцу рекомендуют формулу названия «тип товара + бренд/производитель + модель + отличительные характеристики» и обязательно проверять текст: его можно перегенерировать, отредактировать или отклонить. https://partner.market.yandex.ru/chtojournal/start-on-marketplace_neyroseti_dly_marketpleysov/

**Ozon (OzonGenerator)**
- [факт] Генератор встроен в поле «Аннотация», доступен в Ozon Seller, лимит 50 генераций в месяц. https://habr.com/ru/posts/910224/
- [факт] Генератор опирается на заполненные атрибуты, поэтому сначала атрибуты, потом текст. Расхождение текста с атрибутами («95% хлопок» против «100% хлопок») считается ошибкой модерации. https://mpseo.ru/neyroset-dlya-opisaniya-tovara/
- [факт] В практическом гайде модели дают список атрибутов и паспорт изделия, она «честно помечает „нет данных“ для полей, которых нет в паспорте». Такие поля уточняют у поставщика. Галлюцинации там названы «лечатся только сверкой с фактурой». https://mpseo.ru/neyroset-dlya-kartochek-ozon/

**Wildberries**
- [факт] Генератор описаний в карточке. Управляющие параметры: ключевые слова (до 300 символов), длина (короткий, средний, длинный), тональность (нейтральная, дружелюбная, эмоциональная). Генерация идёт по названию и характеристикам, результат можно править вручную или перегенерировать. https://www.avoshop.ru/company/news/2024/wildberries_sozdavat_opisaniya_v_kartochkakh_tovarov_s_pomoshchyu_neyroseti_stalo_proshche/ , https://www.forbes.ru/novosti-kompaniy/527551-opisania-tovarov-na-wildberries-budet-sozdavat-nejroset

**Авито (Хабр, ds-team)**
- [факт] Бэкенд разбит на три шага: **префильтрация → генерация → постфильтрация**. Постфильтр отбраковывает, например, тексты с плейсхолдерами и слишком длинные тексты. Если описание не проходит требования, «модель ничего не выдаёт». https://habr.com/ru/companies/avito/articles/906504/

**Raft (Хабр, LLaMA для SEO-описаний ритейла)**
- [факт] Итерации промпта привели к фиксированной структуре входа из 10 полей: артикул, наименование, вид продукции, тезисы, акцент, стилистика, «сочетается с», «важно», пример для вдохновения, ключевые слова (вставлять в точном виде). https://habr.com/ru/companies/raft/articles/934458/

### 1.2 Технические и B2B-товары: защита от выдуманных атрибутов

- [факт] Anglera (статья 2026 года про промышленные детали): если дать модели только артикул и короткий текст из ERP, она заполняет пробелы «the most common value for the category». Предложенный пайплайн: **собрать источники → извлечь атрибуты в фиксированную схему категории → валидировать и нормализовать (единицы, конфликты; пропуски помечаются `not provided`) → генерировать только из проверенной записи → сверить текст обратно с записью: каждое число и единица должны совпасть с полем, а прилагательные без атрибута за ними вырезаются**. Отдельно названы типовые сбои: дрейф единиц (bar/psi) и «variant bleed», когда в текст попадает характеристика соседнего исполнения из того же паспорта. https://www.anglera.com/blog/ai-product-descriptions-industrial-parts
- [факт] PiSrc, кейс производителя промышленной автоматизации: генерация только из исходных полей с явным запретом выводить характеристики из общих знаний; пропущенное поле опускается, а не угадывается. «Factual anchoring»: каждое утверждение прослеживается к полю, поэтому ревью быстрое. Контролируемый словарь терминов, обязательное ревью без автопубликации, низкая уверенность (мало входных данных) уходит старшему ревьюеру. https://www.pisrc.com/insights/generative-ai-for-product-content-with-guardrails
- [факт] SKULaunch про B2B: закупщик «scan for fit, not persuasion». Сначала тип и конструкция, затем номиналы и ограничения, затем присоединение, габариты и стандарты. Прилагательные вроде «premium» информации не несут. Ключевые значения надо повторять и в тексте, и в таблице, потому что многие читают что-то одно. https://skulaunch.com/use-cases/b2b-product-descriptions
- [факт] Anthropic, документация «Reduce hallucinations»: явно разрешить модели сказать «не знаю»; ограничить её предоставленными данными («External knowledge restriction»); проверять каждое утверждение цитатой и удалять неподтверждённые. https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
- [факт] Structured outputs у Anthropic (`output_config.format`, JSON Schema) и OpenAI (`json_schema`, `strict: true`) гарантируют соответствие схеме, то есть отсутствие пропущенных обязательных ключей и невалидных enum. https://platform.claude.com/docs/en/build-with-claude/structured-outputs , https://developers.openai.com/api/docs/guides/structured-outputs
- [вывод] Structured output гарантирует **форму**, но не **правдивость** значений. Сверка значений с входом остаётся на нашем коде.

### 1.3 Open-source репозитории (что взять, что нет)

| Репозиторий | Что полезно | Чего нет |
|---|---|---|
| google-marketing-solutions/description_genius https://github.com/google-marketing-solutions/description_genius/ | CSV с характеристиками на вход, few-shot примеры задают формат вывода, дополнительный контекст подтягивается через vector search | Нет защиты от выдумок, привязка к Vertex AI |
| RareBeacon/ai-ecommerce-description-gen https://github.com/RareBeacon/ai-ecommerce-description-gen | Пайплайн `CSV → LLM → SEO Scoring → output`, автопроверка длины meta title/description и наличия ключа | Привязка к входным данным не проверяется |
| AspiranteD/ai-product-enrichment https://github.com/AspiranteD/ai-product-enrichment | Стадии в отдельных модулях (`pipeline`, `description_generator`, `policy_sanitizer`), JSON-вывод, **110+ pytest с замоканным API**, regex-санитайзер | Домен — потребительские товары |
| nitesh-kumawat911/claude-shopify-descriptions https://github.com/nitesh-kumawat911/claude-shopify-descriptions/blob/main/README.md | Короткий README: что делает, пример JSON-вывода, пример входа, одна команда запуска, «только `name` обязателен» | Нет валидации |
| mage-os-lab/module-catalog-data-ai, angeo-dev/module-ai-description-updater (Magento) | Шаблоны промптов с `{{attribute}}`, режим `--dry-run` | Генерация «из названия», что противоположно нашему требованию |

[вывод] Публичного open-source решения, которое делало бы именно B2B/КИП с жёстким запретом на выдуманные характеристики и списком «требует уточнения», мы не нашли. Это и есть наше отличие, его стоит прямо заявить в README.

### Что применяем у нас (раздел 1)

1. **Пайплайн из 5 шагов** (по образцу Avito, Amazon и Anglera): `вход → валидация и нормализация (Pydantic) → генерация (structured output) → постпроверка (код) → черновик + список «требует уточнения» для человека`. Автопубликации нет, итог — черновик (принцип Shopify «let the merchant decide»).
2. **Детерминированная проверка на выдумки после генерации.** Извлекаем из ответа все числа с единицами (МПа, мм, °C, G1/2, IP…) и сверяем с нормализованными входными значениями. Несовпадения выносим в `warnings` и подсвечиваем. Дешёвая реализация первой фазы Amazon (recall) без второй LLM. Вторую LLM-проверку описываем в «улучшениях».
3. **Схема характеристик для КИП.** Ожидаемые поля категории (диапазон, класс точности, присоединение, диаметр корпуса, рабочая среда, температура среды, IP, исполнение, межповерочный интервал, госреестр СИ…) задаём в коде. Отсутствующее поле получает значение «данных нет» в коде, не через LLM, и попадает в `missing_fields`. Так проще гарантировать требование «данных нет».
4. **Таблицу характеристик собираем из входа кодом, а не моделью.** LLM пишет только тексты: SEO-заголовок, описание, запросы, commercial-блок. Это убирает целый класс галлюцинаций.
5. **Промпт.** Явный запрет на общие знания, разрешение писать «данных нет», правило гранулярности («не огрублять и не уточнять значения», по Amazon), B2B-тон без пустых прилагательных (по SKULaunch).
6. **Постфильтр по Avito:** длина заголовка ≤ 70, описание 800–1200 символов, нет плейсхолдеров. При нарушении делаем один ретрай с текстом ошибки (идея assertions-as-retry, см. Hamel Husain, раздел 4), затем отдаём с предупреждением.

---

## 2. Выбор стека для прототипа с веб-формой

Требования, которые влияют на выбор: вход и в JSON, и через веб-форму; запуск в 1–3 команды; 2–4 часа работы; результат легко копировать.

| Вариант | Плюсы | Минусы для нашей задачи |
|---|---|---|
| **FastAPI + Jinja2 (+ немного JS или HTMX)** | В одном процессе есть JSON API (`POST /api/generate`) и HTML-форма; Swagger `/docs` бесплатно, ревьюер может дёрнуть API без UI. Jinja2Templates официально поддержан в FastAPI https://fastapi.tiangolo.com/advanced/templates/ . Полный контроль над разметкой: кнопки «копировать», счётчики, подсветка. HTMX позволяет обойтись почти без JS, стек считают лёгким и гибким https://medium.com/@prestonblckbrn/streamlit-vs-htmx-llm-streaming-chatbots-783708e3cddb , https://community.oppkey.host/t/assessment-of-async-tools-in-building-ai-tools-my-experience-with-htmx-fastapi-llm-sse-and-jinja/619 | Нужно написать шаблон и чуть CSS/JS (≈ 30–45 минут) |
| **Streamlit** | Самый быстрый UI на чистом Python; есть `st.download_button` для выгрузки .md/.json https://docs.streamlit.io/develop/api-reference/widgets/st.download_button и `st.code` для блоков https://docs.streamlit.io/develop/api-reference/text/st.code ; хорош для внутренних инструментов и PoC https://www.squadbase.dev/en/blog/streamlit-vs-gradio-in-2025-a-framework-comparison-for-ai-apps | Нет отдельного JSON-эндпоинта (нужен второй процесс или CLI); кастомизация через обходные пути и React-компоненты (там же, Medium) |
| **Gradio** | Быстрая демо-форма, у Textbox и Markdown есть встроенная кнопка копирования | Ориентирован на ML-демо; API меняется между мажорами: в Gradio 6 убрали `show_copy_button`, теперь `buttons=["copy"]` https://gradio.app/main/guides/gradio-6-migration-guide , так что примеры из интернета ломаются. Подходит для прототипов, а не для «живых» приложений https://steincode.com/en/blog/2025/gradio-vs-streamlit/ |
| **Next.js** | Лучший контроль над UI («look-and-feel») https://sider.ai/blog/ai-tools/gradio-alternatives-that-don-t-make-you-gradio-sly-angry-the-hands-on-guide | Для 2–4 часов избыточен: node_modules, сборка, второй язык, если ядро на Python; запуск сложнее |

Дополнительно:
- [факт] `navigator.clipboard.writeText()` работает только в secure context (https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText). `http://localhost` считается secure context (https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts), поэтому кнопки копирования в локальном FastAPI-прототипе работают без HTTPS. [вывод] При открытии по `http://127.0.0.1` тоже (loopback), а по IP в LAN — нет. Это стоит упомянуть в ограничениях.
- [факт] `uv run` сам приводит окружение в актуальное состояние перед запуском команды (https://docs.astral.sh/uv/concepts/projects/run/), поэтому запуск укладывается в «скопировать .env → `uv run …`».

### Что применяем у нас (раздел 2) — рекомендация

**FastAPI + Jinja2 + ~50 строк vanilla JS** (HTMX по желанию, он не обязателен).
- Одно ядро `generate_card(product) -> CardResult` и три входа к нему: веб-форма `/`, `POST /api/generate` (JSON), CLI `python -m app.cli examples/*.json --out results/` для генерации примеров к сдаче.
- Запуск: `cp .env.example .env` → `uv run uvicorn app.main:app` (плюс вариант через `pip install -r requirements.txt` для тех, у кого нет uv).
- Форма: поля name, manufacturer, description, динамические пары «характеристика — значение» **и** вкладка «вставить JSON», потому что ТЗ требует оба способа ввода.
- План Б, если время поджимает: Streamlit-экран поверх того же ядра. Gradio и Next.js не берём.

---

## 3. Удобство результата для контент-менеджера

Находки:
- [факт] Площадки (Яндекс Маркет, WB, Ozon) везде дают **перегенерировать, отредактировать или отклонить** и подчёркивают, что текст надо проверить (ссылки в разделе 1). Amazon отдаёт черновик на «approve or edit».
- [факт] GOV.UK Design System, компонент Character count: показывать, сколько символов осталось, и **не блокировать ввод сверх лимита**, а сообщать о превышении. Скринридеру — объявление после паузы. https://design-system.service.gov.uk/components/character-count/
- [факт] RareBeacon автоматически оценивает каждый вывод по длине meta title/description и наличию ключа (галочки ✅). https://github.com/RareBeacon/ai-ecommerce-description-gen
- [факт] PiSrc: ревью быстрое, когда каждое утверждение прослеживается к полю источника. Записи с малым количеством данных отдельно помечаются как низкоуверенные. https://www.pisrc.com/insights/generative-ai-for-product-content-with-guardrails
- [факт] SKULaunch: описания проверяют рядом с атрибутами, из которых они сделаны. https://skulaunch.com/use-cases/b2b-product-descriptions
- [факт] Shopify: генерированный текст может отличаться разметкой; claude-shopify-descriptions сразу отдаёт `body_html` «paste-ready». https://github.com/nitesh-kumawat911/claude-shopify-descriptions/blob/main/README.md
- [факт] Google: жёсткого лимита на `<title>` нет, заголовок обрезается по ширине устройства; keyword stuffing и шаблонные заголовки вредны. https://developers.google.com/search/docs/appearance/title-link . [вывод] Лимит 70 символов берём из ТЗ, а SEO-запросы не набиваем в заголовок.

### Что применяем у нас (раздел 3)

1. **Блок на каждое поле** (заголовок, описание, характеристики, запросы, commercial) со своей кнопкой «Копировать». Отдельные кнопки «Скопировать всё как Markdown», «Скачать .md» и «Скачать .json».
2. **Счётчики символов со статусом:** `SEO-заголовок: 64/70 ✓`, `Описание: 1 134 (норма 800–1200) ✓`. При выходе за границы — жёлтый статус, текст не обрезаем молча (по GOV.UK).
3. **«данных нет»** в таблице характеристик выделяем визуально (серый курсив и бейдж). При копировании это остаётся текстом «данных нет», как требует ТЗ.
4. **Панель «Требует уточнения» над результатом:** список `missing_fields` (ожидаемые для КИП поля, которых нет во входе) и `warnings` (число в тексте не найдено во входе; превышена длина; пустое описание на входе). У каждого пункта короткая причина, например «класс точности не указан — уточнить у производителя/в паспорте».
5. **Таблица характеристик из входа** рядом с текстом (вход ↔ результат), чтобы менеджер сверял за секунды.
6. **Markdown — основной формат для копирования** (заголовки, список, таблица характеристик). HTML-экспорт добавляем, только если остаётся время, и упоминаем в улучшениях.
7. **Ошибки — человеческим языком:** «Некорректный JSON: строка 5, ожидалась запятая», «LLM недоступна, повторите через минуту», а не traceback.

---

## 4. README и подача тестового задания

### 4.1 Что ценят ревьюеры

- [факт] Порядок проверки: 1) запускается ли по README с первого раза; 2) работает ли основной сценарий, включая «грязные» данные; 3) читаемость; 4) видны ли в README суждения (допущения, trade-offs); 5) только потом «впечатляющие» вещи. Выбор фреймворка и процент покрытия в этот список не входят. https://learnfde.dev/blog/fde-take-home-assignment.html
- [факт] «The one thing that fails instantly: a project that does not run from a clean checkout». Оверинжиниринг (auth, Docker, CI на маленькое задание) читается как плохое суждение. Мнения лучше писать в README, а не в код. https://copilotinterview.com/blog/take-home-assignment-interview
- [факт] Самый сильный дифференциатор — явный список того, что сознательно не сделано. Иначе ревьюер не отличит «решил не делать» от «не подумал». «Что сделал бы ещё» должно быть конкретным, а не «добавить тесты». README на 1–2 страницы. https://www.skillveris.com/blog/scope-and-submit-take-home-assignments
- [факт] Самому назвать «хакнутое» место: «converts a weakness into a judgment signal». https://learnfde.dev/blog/fde-take-home-assignment.html
- [факт] Указать затраченное время и что срезано. https://addaly.com/learn/ai-careers/the-take-home
- [факт] Для LLM-задач: Level 1 evals — это assertions в стиле pytest, быстрые и дешёвые. Их же можно использовать для автоматических ретраев, подставляя текст ошибки. https://hamel.dev/blog/posts/evals/index.html
- [факт] Русскоязычные ревьюеры: README с инструкцией запуска фактически обязателен, без него часто не проверяют (https://www.forpes.ru/post/192447). Перед сдачей склонировать репозиторий в чистую папку и пройти README; проверить, что нет секретов и `.DS_Store`; приложить короткое сопроводительное письмо (https://interview-assistant.ru/blog/testovoe-zadanie-razrabotchika). Нужны `.env.example`, секреты в `.gitignore`, зафиксированные версии, тесты на happy path и 1–2 негативных сценария, несколько осмысленных коммитов (https://spirzen.ru/encyclopedia/1-basics/1-26-karera-v-it-i-mify/131).
- [факт] AI в тестовых уже не красный флаг, но кандидат должен «владеть» каждой строкой и уметь объяснить её на созвоне. Типичный вопрос: «что поменять, если слегка изменить условие». https://habr.com/ru/articles/990396/ . Ревьюеры советуют запускать решение до чтения README и не верить фразам вроде «краевые случаи обработаны» без проверки. https://sloger.press/p/1429
- [факт] Сигналы «ИИ-текста», которые раздражают: лишние комментарии в коде, разный стиль текста. https://habr.com/ru/articles/855342/
- [факт] GitHub: README отвечает, что делает проект, зачем он и как начать (https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes). Шаблон makeareadme — Installation и Usage с реальным примером (https://www.makeareadme.com/).
- Пример сильного короткого README в нашем домене: claude-shopify-descriptions. Что делает → пример JSON-вывода → как подать свои данные → одна команда. https://github.com/nitesh-kumawat911/claude-shopify-descriptions/blob/main/README.md

### 4.2 Рекомендуемая структура README

1. **Одной фразой:** что делает сервис, и сразу скриншот формы с результатом.
2. **Быстрый старт (≤ 3 команды):** `cp .env.example .env` (вписать ключ) → `uv run uvicorn app.main:app` → открыть `http://localhost:8000`. Плюс `curl` к `/api/generate` и CLI-команда.
3. **Пример вывода:** ссылки на `examples/results/*.md|json` для двух товаров (обязательно по ТЗ) и короткий фрагмент прямо в README.
4. **Как это работает:** схема пайплайна в 5 шагов (раздел 1), одной диаграммой или списком.
5. **Промпты и решения:** где лежит промпт, ключевые правила (только входные данные, «данных нет», гранулярность значений, B2B-тон), почему таблица характеристик собирается кодом, почему structured output, выбор модели.
6. **Защита от выдумок:** как проверяем числа и единицы, что попадает в «требует уточнения». Честно назвать, что проверка ловит не всё, например качественные утверждения вроде «устойчив к вибрации».
7. **Обработка ошибок:** невалидный JSON, пустые поля, таймауты и 4xx/5xx API, невалидный ответ модели → ретрай.
8. **Тесты:** `uv run pytest`, тесты с замоканным LLM (как в AspiranteD) плюс assertions на длины и «данных нет».
9. **Ограничения** и «сознательно не делали»: БД, auth, деплой, RAG — их нет по ТЗ; одна категория КИП; clipboard только на localhost.
10. **Улучшения** (конкретно и по ценности): вторая LLM-проверка по каждому утверждению (Amazon dual-LLM), справочник категорий и единиц, пакетная обработка CSV, HTML-экспорт под CMS, few-shot по эталонным карточкам компании, eval-набор из 20–30 приборов.
11. **Затраченное время.**

### 4.3 Сопроводительное сообщение (hh или почта), 6–10 предложений

Структура по spirzen.ru и talanto.work (https://talanto.work/articles/testovoe-zadanie-na-rabotu):
1. Приветствие, вакансия, ссылка на репозиторий.
2. Что реализовано: 3–4 пункта по требованиям ТЗ (форма и JSON, 5 блоков карточки, «данных нет» и список уточнений, обработка ошибок).
3. Ключевые решения: 2–3 пункта. Характеристики собирает код, LLM пишет только тексты; проверка чисел против входа; structured output.
4. Сложности и как решены, например удержание описания в 800–1200 символов через проверку и ретрай.
5. Ограничения и что сделал бы дальше: 1–2 строки, подробности в README.
6. Время, потраченное на задание; скриншот или GIF; готовность разобрать решение на созвоне.

[вывод] Не писать «проверено», если не запускалось (совет talanto.work). Модель, промпт-подход и время указывать прямо.

### Что применяем у нас (раздел 4)

- Последний шаг перед сдачей: `git clone` в `/tmp`, пройти README буквально, без ключа проверить внятную ошибку, с ключом — оба примера.
- `.env.example`, `.env` в `.gitignore`, зафиксированные версии (`uv.lock`).
- 5–10 осмысленных тестов: парсинг JSON, пустые поля → «данных нет», детектор чисел-выдумок, длины, мок LLM-ошибки.
- В README — разделы «Сознательно не делали» и «Слабое место» (называем сами).
- Без Docker, CI и auth: это оверинжиниринг для задания на 2–4 часа (copilotinterview).

---

## Источники

Площадки и инженерные блоги
- https://aws.amazon.com/blogs/machine-learning/going-beyond-ai-assistants-examples-from-amazon-com-reinventing-industries-with-generative-ai/
- https://www.amazon.science/publications/hallucination-detection-in-llm-enriched-product-listings
- https://www.amazon.science/blog/using-llms-to-improve-amazon-product-listings
- https://aws.amazon.com/blogs/machine-learning/how-the-amazon-com-catalog-team-built-self-learning-generative-ai-at-scale-with-amazon-bedrock/
- https://help.shopify.com/en/manual/products/details/product-descriptions/generate
- https://creatoreconomy.so/p/how-shopify-built-generative-ai
- https://yandex.cloud/ru/cases/yandex-market
- https://partner.market.yandex.ru/chtojournal/start-on-marketplace_neyroseti_dly_marketpleysov/
- https://habr.com/ru/posts/910224/
- https://mpseo.ru/neyroset-dlya-opisaniya-tovara/
- https://mpseo.ru/neyroset-dlya-kartochek-ozon/
- https://www.avoshop.ru/company/news/2024/wildberries_sozdavat_opisaniya_v_kartochkakh_tovarov_s_pomoshchyu_neyroseti_stalo_proshche/
- https://www.forbes.ru/novosti-kompaniy/527551-opisania-tovarov-na-wildberries-budet-sozdavat-nejroset
- https://habr.com/ru/companies/avito/articles/906504/
- https://habr.com/ru/companies/raft/articles/934458/

B2B и технические товары, защита от галлюцинаций
- https://www.anglera.com/blog/ai-product-descriptions-industrial-parts
- https://www.pisrc.com/insights/generative-ai-for-product-content-with-guardrails
- https://skulaunch.com/use-cases/b2b-product-descriptions
- https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://developers.openai.com/api/docs/guides/structured-outputs

Open-source
- https://github.com/google-marketing-solutions/description_genius/
- https://github.com/RareBeacon/ai-ecommerce-description-gen
- https://github.com/AspiranteD/ai-product-enrichment
- https://github.com/nitesh-kumawat911/claude-shopify-descriptions/blob/main/README.md
- https://github.com/mage-os-lab/module-catalog-data-ai
- https://github.com/angeo-dev/module-ai-description-updater

Стек и UI
- https://fastapi.tiangolo.com/advanced/templates/
- https://medium.com/@prestonblckbrn/streamlit-vs-htmx-llm-streaming-chatbots-783708e3cddb
- https://community.oppkey.host/t/assessment-of-async-tools-in-building-ai-tools-my-experience-with-htmx-fastapi-llm-sse-and-jinja/619
- https://www.squadbase.dev/en/blog/streamlit-vs-gradio-in-2025-a-framework-comparison-for-ai-apps
- https://steincode.com/en/blog/2025/gradio-vs-streamlit/
- https://sider.ai/blog/ai-tools/gradio-alternatives-that-don-t-make-you-gradio-sly-angry-the-hands-on-guide
- https://gradio.app/main/guides/gradio-6-migration-guide
- https://docs.streamlit.io/develop/api-reference/text/st.code
- https://docs.streamlit.io/develop/api-reference/widgets/st.download_button
- https://docs.astral.sh/uv/concepts/projects/run/
- https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- https://design-system.service.gov.uk/components/character-count/
- https://developers.google.com/search/docs/appearance/title-link

README, ревью, подача
- https://learnfde.dev/blog/fde-take-home-assignment.html
- https://copilotinterview.com/blog/take-home-assignment-interview
- https://www.skillveris.com/blog/scope-and-submit-take-home-assignments
- https://addaly.com/learn/ai-careers/the-take-home
- https://hamel.dev/blog/posts/evals/index.html
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
- https://www.makeareadme.com/
- https://www.forpes.ru/post/192447
- https://interview-assistant.ru/blog/testovoe-zadanie-razrabotchika
- https://spirzen.ru/encyclopedia/1-basics/1-26-karera-v-it-i-mify/131
- https://talanto.work/articles/testovoe-zadanie-na-rabotu
- https://habr.com/ru/articles/990396/
- https://sloger.press/p/1429
- https://habr.com/ru/articles/855342/
