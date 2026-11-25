import { E, button, externalLink, image } from './dom.js?v=wedding-features-58';
import { safeUrl, formatDate } from './content.js?v=wedding-features-58';
import { StorageConflict } from './storage.js?v=wedding-features-58';
import { COST_LABELS, stayReview, dateSpan, emptyQuote, quoteBasis, CLIMATE_CATEGORIES } from './travel.js?v=wedding-features-58';
import { hasActiveTripFilters, matchesAllTripFilters, resetTripFilters } from './travel-ui.js?v=wedding-features-58';

const fieldSpecs = {
  invitation: [
    ['partner1', '첫 번째 이름'],
    ['partner2', '두 번째 이름'],
    ['groomParents', '신랑 측 혼주 표기 (선택, 예: 홍길동 · 김영희 의 장남)'],
    ['brideParents', '신부 측 혼주 표기 (선택, 예: 이철수 · 박미영 의 차녀)'],
    ['date', '예식 날짜', 'date'],
    ['time', '예식 시간', 'time'],
    ['venue', '예식장·홀 이름'],
    ['address', '주소'],
    ['mapUrl', '지도 링크', 'url'],
    ['venueMapImage', '오시는 길 약도 이미지 주소 (선택)'],
    ['message', '초대 인사', 'textarea'],
    ['transit', '오시는 길 · 교통·주차 안내 (선택)', 'textarea'],
    ['notice', '예식 안내 메모 (식사·포토부스·축의 등, 선택)', 'textarea'],
    ['contacts', '연락처 안내 (선택, 한 줄에 하나씩 · 전화번호 입력 시 전화·문자 버튼 표시)', 'textarea'],
    ['groomAccounts', '신랑 측 계좌번호 안내 (선택, 한 줄에 하나씩)', 'textarea'],
    ['brideAccounts', '신부 측 계좌번호 안내 (선택, 한 줄에 하나씩)', 'textarea'],
    ['rsvpUrl', '참석 여부(RSVP) · 축하 메시지 설문 링크 (선택, Google Forms 등 https:// 주소)', 'url']
  ],
  stories: [
    ['title', '이야기 제목'],
    ['date', '기억할 날짜', 'date'],
    ['body', '우리의 이야기', 'textarea'],
    ['image', '사진 주소 (선택)']
  ],
  albums: [
    ['title', '앨범 이름'],
    ['date', '촬영 날짜', 'date'],
    ['body', '앨범 소개', 'textarea'],
    ['urls', '사진 주소 (한 줄에 하나씩)', 'textarea']
  ],
  honeymoon: [
    ['title', '여행지'],
    ['country', '나라·지역'],
    ['startDate', '한국 출발일', 'date'],
    ['endDate', '한국 도착일', 'date'],
    ['budget', '두 사람의 계획예산 (원)', 'number'],
    ['pros', '마음에 드는 점', 'textarea'],
    ['cons', '고민할 점', 'textarea'],
    ['body', '일정·상담 메모', 'textarea'],
    ['url', '참고 링크', 'url']
  ],
  tips: [
    ['title', '꿀팁·영상 제목'],
    ['category', '분류 (예: 예산·체크리스트, 스드메·웨딩촬영)'],
    ['channel', '채널·출처 (선택)'],
    ['body', '핵심 꿀팁 요약·메모', 'textarea'],
    ['url', '유튜브 또는 참고 링크', 'url']
  ]
};

export async function shrinkPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG, WEBP 사진을 선택해 주세요.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('사진 한 장은 20MB 이하로 선택해 주세요.');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpegUrl = canvas.toDataURL('image/jpeg', 0.78);
  try {
    const webpUrl = canvas.toDataURL('image/webp', 0.8);
    if (webpUrl.startsWith('data:image/webp;') && webpUrl.length < jpegUrl.length) {
      return webpUrl;
    }
  } catch {}
  return jpegUrl;
}

function createPhotoDropzone({ input, label, hint, multiple = false, onFiles }) {
  const dropzone = E('div', { class: 'photo-dropzone', 'data-dropzone': multiple ? 'multi' : 'single' },
    E('div', { class: 'photo-dropzone-head' },
      E('span', { class: 'photo-dropzone-icon', 'aria-hidden': 'true' }, multiple ? '🖼️' : '📷'),
      E('div', { class: 'photo-dropzone-copy' },
        E('strong', {}, label),
        E('span', { class: 'small muted' }, hint || (multiple ? 'JPG·PNG·WEBP 사진을 끌어다 놓거나 아래 버튼으로 여러 장 선택하세요.' : 'JPG·PNG·WEBP 이미지를 끌어다 놓거나 아래에서 파일을 선택하세요.')))),
    input);

  let dragDepth = 0;
  const clearDrag = () => {
    dragDepth = 0;
    dropzone.classList.remove('is-dragover');
  };
  dropzone.addEventListener('dragenter', event => {
    event.preventDefault();
    dragDepth++;
    if (!input.disabled) dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = input.disabled ? 'none' : 'copy';
  });
  dropzone.addEventListener('dragleave', event => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', async event => {
    event.preventDefault();
    clearDrag();
    if (input.disabled) return;
    const dropped = [...(event.dataTransfer?.files || [])];
    if (!dropped.length) return;
    await onFiles(multiple ? dropped : [dropped[0]]);
  });
  input.addEventListener('change', async () => {
    const selected = [...(input.files || [])];
    if (!selected.length) return;
    await onFiles(multiple ? selected : [selected[0]]);
  });
  return dropzone;
}

function stayEditor(ctx, form, fields, plan) {
  const stays = plan.stays.map(stay => ({ ...stay, nights: String(stay.nights), checkIn: stay.checkIn || '', checkOut: stay.checkOut || '' }));
  let basis = { startDate: plan.dateBasis?.startDate || fields.startDate.value, endDate: plan.dateBasis?.endDate || fields.endDate.value };
  const currentBasis = () => ({ startDate: basis.startDate || fields.startDate.value, endDate: basis.endDate || fields.endDate.value });
  const rows = E('div', { class: 'stay-editor-rows' }), status = E('p', { class: 'form-note', role: 'status' });
  const read = () => stays.map(stay => ({ ...stay, region: stay.region.trim(), nights: stay.nights === '' ? null : Number(stay.nights) }));
  const preview = () => { status.textContent = stayReview({ startDate: fields.startDate.value, endDate: fields.endDate.value, plan: { stays: read(), dateBasis: currentBasis() } }).message; };
  const draw = focusIndex => {
    rows.replaceChildren(...stays.map((stay, index) => {
      const group = E('fieldset', { class: 'stay-edit-row' }, E('legend', {}, `숙박 ${index + 1}`));
      const inputs = {};
      for (const [key, label, type] of [['region', '숙박 지역', 'text'], ['nights', '숙박 박 수', 'number'], ['checkIn', '현지 체크인', 'date'], ['checkOut', '현지 체크아웃', 'date']]) {
        const input = E('input', { type, id: `stay-${index}-${key}` });
        input.value = stay[key];
        inputs[key] = input;
        if (type === 'number') { input.min = '1'; input.max = '365'; input.step = '1'; }
        if (key === 'region') input.maxLength = 120;
        if (key === 'region' || key === 'nights') input.required = true;
        input.addEventListener('input', () => { stay[key] = input.value; sync(); preview(); });
        group.append(E('label', { class: 'field', for: input.id }, `${label} ${index + 1}`, input));
      }
      const sync = () => {
        const span = dateSpan(stay.checkIn, stay.checkOut), derived = span !== null && span > 0;
        inputs.nights.readOnly = derived;
        if (derived) { stay.nights = String(span); inputs.nights.value = stay.nights; }
      };
      sync();
      const move = target => { [stays[index], stays[target]] = [stays[target], stays[index]]; draw(target); preview(); };
      const up = button('앞으로', () => move(index - 1), 'button quiet');
      up.disabled = index === 0;
      const down = button('뒤로', () => move(index + 1), 'button quiet');
      down.disabled = index === stays.length - 1;
      group.append(E('div', { class: 'stay-edit-actions' }, up, down, button(`숙박 ${index + 1} 삭제`, () => { stays.splice(index, 1); draw(Math.min(index, stays.length - 1)); preview(); }, 'button danger')));
      return group;
    }));
    if (focusIndex !== undefined) (rows.children[focusIndex]?.querySelector('input') || add).focus({ preventScroll: true });
  };
  const add = button('숙박 추가', () => {
    if (stays.length >= 20) { ctx.toast('숙박은 20개까지 입력할 수 있습니다.', true); return; }
    stays.push({ region: '', nights: '1', checkIn: '', checkOut: '' });
    draw(stays.length - 1);
    preview();
  }, 'button quiet');
  form.append(
    E('h3', {}, '숙박 구성·현지 날짜'),
    E('p', { class: 'form-note' }, '숙박 순서대로 입력해 주세요. 현지 체크인·체크아웃을 모두 입력하면 박 수를 자동 계산합니다. 항공편과 시차는 별도로 확인해 주세요.'),
    rows,
    add,
    status,
    button('현재 날짜로 가안 기준 갱신', () => {
      if (dateSpan(fields.startDate.value, fields.endDate.value) === null) { ctx.toast('한국 출발·도착 날짜를 먼저 확인해 주세요.', true); return; }
      basis = { startDate: fields.startDate.value, endDate: fields.endDate.value };
      preview();
      ctx.toast('가안 기준 날짜를 갱신했습니다. 초안에 저장해 주세요.');
    }, 'button quiet'));
  fields.startDate.addEventListener('input', preview);
  fields.endDate.addEventListener('input', preview);
  draw();
  preview();
  return { read, basis: currentBasis };
}

function quoteEditor(ctx, form, fields, plan, currentTrip) {
  const original = structuredClone(plan.quote || emptyQuote()), body = E('div', { class: 'quote-editor-body' });
  body.append(E('p', { class: 'form-note' }, '실제 조회한 성인 2명·인천·일반석·객실 1실 견적만 기록하세요. 항공·숙박의 조회 근거와 한국 출발·도착 시각, 기타 여행비까지 입력합니다. 항공권이 통합된 패키지 견적은 항공 실제 견적에 0을 입력하고 숙박·패키지 실제 견적에 2인 패키지 총액을 기록할 수 있습니다. 예비비는 현재 계획 배분을 더하며 예약 확정을 뜻하지 않습니다.'));
  let confirmedBasis = original.basis;
  const matches = () => JSON.stringify(quoteBasis(currentTrip())) === JSON.stringify(confirmedBasis);
  const included = E('input', { type: 'checkbox', id: 'quote-included' });
  const invalidate = () => { if (!matches()) included.checked = false; };
  body.append(button('📦 패키지 통합 견적 (항공 0원 채우기)', () => {
    fields.quote_airfare.value = '0';
    invalidate();
    fields.quote_lodging.focus({ preventScroll: true });
    ctx.toast('항공 실제 견적에 0원(패키지 통합 포함)을 채웠습니다. 숙박·패키지 실제 견적에 2인 통합 견적가를 입력해 주세요.');
  }, 'button quiet'));
  const specs = [
    ...['airfare', 'lodging', 'other'].map(key => [key, `${COST_LABELS[key]} 실제 견적 (원)`, 'number', original.costs[key] ?? '']),
    ['checkedOn', '견적 조회일', 'date', original.checkedOn],
    ['flightSource', '항공 견적 근거·편명·포함 조건', 'textarea', original.flightSource],
    ['lodgingSource', '숙박 견적 근거·객실·포함 조건', 'textarea', original.lodgingSource],
    ['departureAt', '견적 항공편 한국 출발 시각', 'datetime-local', original.departureAt],
    ['arrivalAt', '견적 항공편 한국 도착 시각', 'datetime-local', original.arrivalAt]
  ];
  for (const [key, label, type, value] of specs) {
    const input = type === 'textarea' ? E('textarea', { rows: '3', maxlength: '2000' }) : E('input', { type });
    input.id = 'quote-' + key;
    input.value = value;
    if (type === 'number') { input.min = '0'; input.step = '1'; }
    fields['quote_' + key] = input;
    body.append(E('label', { class: 'field', for: input.id }, label, input));
  }
  included.checked = original.includesRequiredCosts && matches();
  fields.quote_included = included;
  included.addEventListener('change', () => { if (included.checked) confirmedBasis = quoteBasis(currentTrip()); });
  form.addEventListener('input', event => { if (event.target !== included) invalidate(); });
  form.addEventListener('click', event => { if (event.target.closest('button')) invalidate(); });
  body.append(E('label', { class: 'quote-check', for: included.id }, included, '현재 여행 날짜·숙박 구성의 견적이며 세금·수하물·식사·공항 및 지역 이동비를 포함해 확인했습니다.'));
  form.append(E('details', { class: 'quote-editor' }, E('summary', {}, '실제 견적·항공편 기록 (선택)'), body));
  const read = () => ({
    ...original,
    costs: Object.fromEntries(['airfare', 'lodging', 'other'].map(key => [key, fields['quote_' + key].value === '' ? null : Number(fields['quote_' + key].value)])),
    ...Object.fromEntries(['checkedOn', 'flightSource', 'lodgingSource', 'departureAt', 'arrivalAt'].map(key => [key, fields['quote_' + key].value.trim()])),
    includesRequiredCosts: included.checked && matches(),
    basis: confirmedBasis
  });
  return { read };
}

function planExtraEditor(form, fields, plan) {
  const body = E('div', { class: 'quote-editor-body' });
  const monthSelect = E('select', { id: 'plan-climateMonth', 'aria-label': '기후 기준 월' }, [['', '미입력'], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1}월`])].map(([value, label]) => E('option', { value }, label)));
  monthSelect.value = plan.climateMonth === null || plan.climateMonth === undefined ? '' : String(plan.climateMonth);
  fields.plan_climateMonth = monthSelect;
  const categorySelect = E('select', { id: 'plan-climateCategory', 'aria-label': '기후 요약 분류 (기준 월 자료 확인 후 선택)' }, [['', '미분류'], ...Object.entries(CLIMATE_CATEGORIES)].map(([value, label]) => E('option', { value }, label)));
  categorySelect.value = plan.climateSummary && plan.climateSummary.month === plan.climateMonth ? plan.climateSummary.category : '';
  fields.plan_climateCategory = categorySelect;
  const originalCategory = categorySelect.value;
  let categoryTouched = false;
  categorySelect.addEventListener('change', () => { categoryTouched = true; });
  monthSelect.addEventListener('change', () => { categorySelect.value = ''; categoryTouched = true; });
  const specs = [
    ['experiences', '경험 제안', 'textarea', plan.experiences || '', '12000'],
    ['comparisonNote', '후보 한눈에 보기 요약', 'textarea', plan.comparisonNote || '', '500'],
    ['climate', '기후 경향 안내', 'textarea', plan.climate || '', '12000'],
    ['climateMonth', '기후 기준 월', 'select'],
    ['sourceTitle', '기후 출처 이름', 'text', plan.sourceTitle || '', '500'],
    ['sourceUrl', '기후 공식 출처 링크', 'url', plan.sourceUrl || '', '4000'],
    ['checkedOn', '기후 자료 확인일', 'date', plan.checkedOn || '', '10'],
    ['budgetNotes', '비용 배분 참고 설명', 'textarea', plan.budgetNotes || '', '12000'],
    ['researchNotes', '계획 자료·확인 범위 설명', 'textarea', plan.researchNotes || '', '12000'],
    ['references', '추가 조사 출처 (한 줄에 제목 | https://주소)', 'textarea', (plan.references || []).map(r => `${r.title} | ${r.url}`).join('\n'), '24000']
  ];
  const initialValues = {};
  for (const [key, label, kind, value, max] of specs) {
    if (kind === 'select') { initialValues[key] = monthSelect.value; body.append(E('label', { class: 'field', for: monthSelect.id }, label, monthSelect)); continue; }
    const input = kind === 'textarea' ? E('textarea', { rows: '3', maxlength: max }) : E('input', { type: kind, maxlength: max });
    input.id = `plan-${key}`;
    input.value = value;
    initialValues[key] = value;
    fields[`plan_${key}`] = input;
    body.append(E('label', { class: 'field', for: input.id }, label, input));
  }
  form.append(E('details', { class: 'plan-extra-editor' }, E('summary', {}, '기후·경험·출처·비교 요약 편집 (선택)'), body));
  body.append(E('label', { class: 'field', for: categorySelect.id }, '기후 요약 분류 (기준 월 자료 확인 후 선택)', categorySelect), E('p', { class: 'small muted' }, '기후 본문의 단어로 분류를 추측하지 않습니다. 기준 월을 바꾸면 분류를 다시 선택해 주세요.'));
  const read = () => {
    const next = {};
    for (const key of ['experiences', 'comparisonNote', 'climate', 'sourceTitle', 'sourceUrl', 'checkedOn', 'budgetNotes', 'researchNotes']) {
      const raw = fields[`plan_${key}`].value;
      if (raw !== initialValues[key]) next[key] = raw.trim();
    }
    if (monthSelect.value !== initialValues.climateMonth) next.climateMonth = monthSelect.value === '' ? null : Number(monthSelect.value);
    if (categoryTouched || categorySelect.value !== originalCategory) {
      if (categorySelect.value && !monthSelect.value) throw new Error('기후 요약 분류의 기준 월을 먼저 입력해 주세요.');
      next.climateSummary = categorySelect.value ? { month: Number(monthSelect.value), category: categorySelect.value } : null;
    }
    if (fields.plan_references.value !== initialValues.references) {
      next.references = fields.plan_references.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
        const sep = line.indexOf('|');
        if (sep === -1) throw new Error('추가 조사 출처는 한 줄에 "제목 | https://주소" 형식으로 입력해 주세요.');
        return { title: line.slice(0, sep).trim(), url: line.slice(sep + 1).trim() };
      });
    }
    return next;
  };
  return { read };
}

export function openEditor(ctx, type, item = null) {
  if (ctx.isGuestMode()) return;
  const titles = { invitation: '예식 정보 편집', stories: '우리의 이야기', albums: '포토 앨범', honeymoon: '신혼여행 후보', tips: '결혼 정보·꿀팁' };
  const content = ctx.getContent();
  const editingContent = structuredClone(content);
  const values = type === 'invitation' ? content.invitation : (item || {});
  let approvedRaw;
  const form = E('form', { class: 'editor-form' });
  const fields = {};
  form.appendChild(E('p', { class: 'form-note' }, '작성한 내용은 이 브라우저의 초안에 저장됩니다. 공개 사이트 반영은 내용 관리에서 공개용 파일을 저장한 뒤 진행해 주세요.'));
  for (const [key, label, kind = 'text'] of fieldSpecs[type]) {
    const input = kind === 'textarea' ? E('textarea', { rows: '4' }) : E('input', { type: kind });
    input.name = key;
    input.id = `field-${key}`;
    input.value = key === 'urls' ? '' : (values[key] ?? '');
    if (key === 'title') input.required = true;
    if (key === 'budget') { input.min = '0'; input.step = '1'; }
    if (key === 'title') input.maxLength = 160;
    if (key === 'category') input.maxLength = 80;
    if (key === 'channel') input.maxLength = 120;
    if (key === 'groomParents' || key === 'brideParents') input.maxLength = 200;
    if (key === 'transit' || key === 'notice' || key === 'contacts' || key === 'groomAccounts' || key === 'brideAccounts') input.maxLength = 2000;
    fields[key] = input;
    form.appendChild(E('label', { class: 'field', for: input.id }, label, input));
  }
  let albumImages = [...(item?.images || [])], processing = false, saving = false;
  const submit = E('button', { class: 'button', type: 'submit' }, '초안에 저장');

  if (type === 'invitation') {
    const mapPreview = E('div', { class: 'photo-editor' });
    const drawVenueMap = () => {
      const src = safeUrl(fields.venueMapImage.value.trim(), { image: true });
      mapPreview.replaceChildren(...(src ? [E('div', { class: 'photo-edit-card' },
        image(src, '오시는 길 약도 미리보기'),
        E('p', {}, '등록할 예식장 약도'),
        E('div', { class: 'photo-edit-actions' }, button('약도 이미지 삭제', () => { fields.venueMapImage.value = ''; drawVenueMap(); fields.venueMapImage.focus({ preventScroll: true }); }, 'button danger')))] : []));
    };
    fields.venueMapImage.addEventListener('input', drawVenueMap);
    const mapFileInput = E('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'file-input', 'aria-label': '예식장 약도 이미지 파일 선택' });
    const mapDropzone = createPhotoDropzone({
      input: mapFileInput,
      label: '예식장 약도 이미지 드래그·선택 (선택)',
      hint: 'JPG·PNG·WEBP 약도 이미지를 끌어다 놓거나 파일을 선택하면 초안용 크기로 자동 축소합니다.',
      multiple: false,
      onFiles: async ([file]) => {
        if (!file) return;
        processing = true;
        submit.disabled = true;
        mapFileInput.disabled = true;
        try {
          const added = await shrinkPhoto(file);
          if (!form.isConnected || !ctx.isDialogOpen()) return;
          fields.venueMapImage.value = added;
          drawVenueMap();
          ctx.toast('예식장 약도 이미지를 초안용 크기로 줄여 등록했습니다.');
        } catch (error) {
          ctx.toast(error.message, true);
        } finally {
          processing = false;
          submit.disabled = false;
          mapFileInput.disabled = false;
          mapFileInput.value = '';
        }
      }
    });
    const mapFieldWrap = fields.venueMapImage.closest('label');
    const mapUploadBlock = E('div', { class: 'venue-map-editor-block' },
      mapDropzone,
      E('p', { class: 'small muted' }, '약도 이미지를 올리면 청첩장 오시는 길(LOCATION) 섹션에 크게 보기 약도가 표시됩니다. 비워 두면 약도 영역이 자동으로 숨겨집니다.'),
      mapPreview);
    if (mapFieldWrap && mapFieldWrap.parentNode === form) mapFieldWrap.after(mapUploadBlock);
    else form.append(mapUploadBlock);
    drawVenueMap();

    const templates = [
      ['정중한 기본형', '서로가 마주보며 다져온 사랑을\n이제 함께 한곳을 바라보며 걸어갈 수 있는\n큰 사랑으로 키우고자 합니다.\n저희 두 사람이 사랑의 이름으로 지켜나갈 수 있도록\n앞날을 축복해 주시면 감사하겠습니다.'],
      ['따뜻한 감성형', '함께 있을 때 가장 나다운 모습이 되고,\n함께일 때 내일이 더 기대되는 사람을 만났습니다.\n풋풋한 설렘으로 시작해 믿음으로 깊어진 저희 두 사람,\n이제 부부라는 이름으로 첫걸음을 내딛습니다.\n소중한 걸음으로 따뜻한 축복을 더해 주세요.'],
      ['담백한 현대형', '평생을 함께하고 싶은 사람을 만나\n새로운 시작을 하려 합니다.\n귀한 걸음으로 오셔서\n저희의 기쁜 날을 함께 축복해 주시면\n더없는 기쁨으로 간직하겠습니다.']
    ];
    const presetMessages = new Set(templates.map(([, t]) => t));
    const defaultTransit = '· 자가용: 내비게이션 ‘순천아모르웨딩컨벤션’ 또는 ‘압곡길 94’ 검색 (웨딩홀 전용 주차장 이용)\n· KTX/기차: 순천역 하차 후 택시 이용\n· 고속/시외버스: 순천종합버스터미널 하차 후 택시 이용';
    const defaultNotice = '· 하객석 안내: 예식홀 내 사회자 단상이 있는 쪽이 신랑 측, 반대쪽이 신부 측 좌석입니다.\n· 식사 안내: 예식 시작 30분 전부터 연회장에서 식사가 가능합니다.\n· 주차 안내: 웨딩홀 전용 주차장을 무료로 이용하실 수 있습니다.\n· 화환 안내: 축하 화환은 정중히 사양하며 따뜻한 마음만 감사히 받겠습니다.';
    form.appendChild(E('div', { class: 'greeting-templates' },
      E('span', { class: 'small muted' }, '✨ 초대 인사 추천 문구 및 교통·예식 안내 빠른 채우기:'),
      E('div', { class: 'greeting-template-buttons' },
        ...templates.map(([label, text]) => button(label, () => {
          const cur = fields.message.value.trim();
          if (cur && !presetMessages.has(cur) && !confirm('현재 입력된 초대 인사를 선택한 추천 문구로 바꿀까요?')) return;
          fields.message.value = text;
          fields.message.focus({ preventScroll: true });
          ctx.toast(`‘${label}’ 문구를 초대 인사 입력란에 채웠습니다. 자유롭게 다듬어 보세요.`);
        }, 'button quiet')),
        button('🚗 순천아모르웨딩컨벤션 기본 교통·주차 문구 채우기', () => {
          const cur = fields.transit.value.trim();
          if (cur && cur !== defaultTransit && !confirm('현재 입력된 교통·주차 안내를 기본 문구로 바꿀까요?')) return;
          fields.transit.value = defaultTransit;
          fields.transit.focus({ preventScroll: true });
          ctx.toast('기본 교통·주차 안내 문구를 입력란에 채웠습니다.');
        }, 'button quiet'),
        button('📌 기본 식사·예식 안내 예시 채우기', () => {
          const cur = fields.notice.value.trim();
          if (cur && cur !== defaultNotice && !confirm('현재 입력된 예식 안내 메모를 기본 예시 문구로 바꿀까요?')) return;
          fields.notice.value = defaultNotice;
          fields.notice.focus({ preventScroll: true });
          ctx.toast('기본 식사·예식 안내 예시 문구를 채웠습니다. 예식홀 조건에 맞게 수정해 주세요.');
        }, 'button quiet'))));

    const firstAlbumCover = safeUrl(ctx.getContent()?.albums?.[0]?.images?.[0], { image: true });
    const ogImgSrc = firstAlbumCover || './assets/share-card.png';
    const ogTitleEl = E('strong', { class: 'kakao-og-title' });
    const ogDescEl = E('p', { class: 'kakao-og-desc' });
    const syncOgPreview = () => {
      const p1 = fields.partner1.value.trim();
      const p2 = fields.partner2.value.trim();
      const couple = [p1, p2].filter(Boolean).join(' & ');
      ogTitleEl.textContent = couple ? `${couple} · 우리의 결혼 기록` : '우리의 모바일 청첩장';
      const dateStr = fields.date.value ? formatDate(fields.date.value) : '';
      const descParts = [dateStr, fields.time.value.trim(), fields.venue.value.trim()].filter(Boolean);
      ogDescEl.textContent = descParts.join(' · ') || '예식 날짜와 장소를 입력하면 카카오톡 공유 설명에 반영됩니다.';
    };
    for (const key of ['partner1', 'partner2', 'date', 'time', 'venue']) {
      fields[key]?.addEventListener('input', syncOgPreview);
    }
    syncOgPreview();
    form.appendChild(E('div', { class: 'kakao-og-preview-box', 'aria-label': '카카오톡 링크 공유 미리보기' },
      E('div', { class: 'kakao-og-preview-head' },
        E('strong', { class: 'small' }, '💬 카카오톡 링크 공유 카드 미리보기'),
        E('span', { class: 'small muted' }, firstAlbumCover ? '대표 앨범 1번 사진 반영' : '기본 공유 카드 반영')),
      E('div', { class: 'kakao-og-chat-bg' },
        E('div', { class: 'kakao-og-bubble' },
          E('div', { class: 'kakao-og-thumb-wrap' },
            image(ogImgSrc, '카카오톡 공유 카드 미리보기 이미지', { class: 'kakao-og-thumb' })),
          E('div', { class: 'kakao-og-body' },
            ogTitleEl,
            ogDescEl,
            E('span', { class: 'kakao-og-domain' }, 'gmlduqzhd123-lab.github.io'))))));
  }

  let editedPlan, stayFields, quoteFields, extraFields;
  if (type === 'honeymoon') {
    editedPlan = structuredClone(item?.plan || { version: 1, costs: { airfare: null, lodging: null, other: null, reserve: null }, stays: [], lodgingNotes: '', itinerary: '', experiences: '', transport: '', climate: '', climateMonth: null, sourceTitle: '', checkedOn: '', budgetNotes: '' });
    form.append(E('p', { class: 'form-note' }, '참고 링크는 직접 작성하는 메모용 주소이며 기후 공식 출처와 별도로 저장합니다.'));
    if (editedPlan.sourceTitle) form.append(E('div', { class: 'form-note' }, E('p', {}, `기후 자료: ${editedPlan.sourceTitle}${editedPlan.checkedOn ? ' · 자료 확인일 ' + editedPlan.checkedOn : ''}`), externalLink('기후 공식 안내 ↗', editedPlan.sourceUrl || '')));
    stayFields = stayEditor(ctx, form, fields, editedPlan);
    for (const [key, label] of [['lodgingNotes', '숙박 구성 메모'], ['itinerary', '일정 흐름 가안'], ['transport', '계획상 이동']]) {
      const input = E('textarea', { rows: '4', id: `plan-${key}`, maxlength: '12000' });
      input.value = editedPlan[key];
      fields[`plan_${key}`] = input;
      form.append(E('label', { class: 'field', for: input.id }, label, input));
    }
    form.append(E('p', { class: 'form-note' }, '총액과 항목 배분은 별도로 입력합니다. 차이는 미배분 또는 배분 초과로 표시하며 임의로 비용을 채우지 않습니다. 항공권이 통합된 패키지 상품은 항공 배분에 0을 입력하고 숙박·패키지 배분에 2인 상품가를 적을 수 있으며, 제목 앞에 [여행사명]을 붙이면 패키지 배지와 여행사 필터에 자동 반영됩니다.'));
    for (const [key, label] of Object.entries(COST_LABELS)) {
      const input = E('input', { type: 'number', min: '0', step: '1', id: `cost-${key}` });
      input.value = editedPlan.costs[key] ?? '';
      fields[`cost_${key}`] = input;
      form.append(E('label', { class: 'field', for: input.id }, `${label} 배분 (원)`, input));
    }
    form.append(button('배분 합계로 계획예산 채우기', () => {
      const vals = Object.keys(COST_LABELS).map(key => fields[`cost_${key}`].value.trim()).filter(Boolean).map(Number);
      if (!vals.length) { ctx.toast('배분 금액을 먼저 입력해 주세요.', true); return; }
      const sum = vals.reduce((a, b) => a + b, 0);
      fields.budget.value = String(sum);
      ctx.toast(`입력된 배분 합계 ${sum.toLocaleString('ko-KR')}원을 계획예산에 반영했습니다.`);
    }, 'button quiet'));
    quoteFields = quoteEditor(ctx, form, fields, editedPlan, () => ({ country: fields.country.value.trim(), startDate: fields.startDate.value, endDate: fields.endDate.value, plan: { stays: stayFields.read() } }));
    extraFields = planExtraEditor(form, fields, editedPlan);
  }

  if (type === 'stories') {
    const storyGuides = [
      ['🌱 첫 만남', '우리가 처음 만난 날', '처음 만났던 장소와 첫인상, 그때 나눴던 대화와 분위기를 자유롭게 적어 보세요.'],
      ['💬 기억에 남는 데이트', '가장 기억에 남는 데이트', '계절과 장소, 함께 먹었던 음식, 두 사람이 함께 크게 웃었던 순간을 남겨 보세요.'],
      ['✈️ 함께한 여행', '둘이서 함께 떠난 여행', '여행지에서 마주한 풍경과 에피소드, 서로에게 새롭게 발견한 든든한 모습을 기록해 보세요.'],
      ['💍 결혼을 결심한 순간', '평생을 함께하기로 결심한 순간', '이 사람과 평생을 함께하고 싶다고 느꼈던 따뜻한 순간이나 프러포즈의 기억을 적어 보세요.'],
      ['🏠 우리의 다짐', '부부로서 시작하는 우리의 다짐', '2027년 6월 5일 예식을 앞두고, 앞으로 어떤 부부로 살아가고 싶은지 서로에게 남기는 다짐을 적어 보세요.']
    ];
    const presetTitles = new Set(storyGuides.map(([, t]) => t));
    const presetBodies = new Set(storyGuides.map(([, , g]) => g));
    form.appendChild(E('div', { class: 'greeting-templates' },
      E('span', { class: 'small muted' }, '💡 이야기 주제 가이드 (클릭하면 제목과 작성 가이드가 채워집니다):'),
      E('div', { class: 'greeting-template-buttons' },
        ...storyGuides.map(([chip, titleText, guideText]) => button(chip, () => {
          const curTitle = fields.title.value.trim(), curBody = fields.body.value.trim();
          const hasCustom = (curTitle && !presetTitles.has(curTitle)) || (curBody && !presetBodies.has(curBody));
          if (hasCustom && !confirm('현재 작성 중인 내용을 선택한 주제 가이드로 바꿀까요?')) return;
          fields.title.value = titleText;
          fields.body.value = guideText;
          fields.body.focus({ preventScroll: true });
          ctx.toast(`‘${chip}’ 이야기 가이드를 채웠습니다. 우리만의 이야기로 바꿔 보세요.`);
        }, 'button quiet')))));
    const preview = E('div', { class: 'photo-editor' });
    const drawStoryPhoto = () => {
      const src = safeUrl(fields.image.value.trim(), { image: true });
      preview.replaceChildren(...(src ? [E('div', { class: 'photo-edit-card' },
        image(src, '이야기 사진 미리보기'),
        E('p', {}, '등록할 사진'),
        E('div', { class: 'photo-edit-actions' }, button('사진 삭제', () => { fields.image.value = ''; drawStoryPhoto(); fields.image.focus({ preventScroll: true }); }, 'button danger')))] : []));
    };
    fields.image.addEventListener('input', drawStoryPhoto);
    const fileInput = E('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'file-input', 'aria-label': '사진 파일 선택' });
    const storyDropzone = createPhotoDropzone({
      input: fileInput,
      label: '이야기 사진 드래그·선택 (선택)',
      hint: 'JPG·PNG·WEBP 사진을 끌어다 놓거나 파일을 선택하면 초안용으로 자동 축소합니다.',
      multiple: false,
      onFiles: async ([file]) => {
        if (!file) return;
        processing = true;
        submit.disabled = true;
        fileInput.disabled = true;
        try {
          const added = await shrinkPhoto(file);
          if (!form.isConnected || !ctx.isDialogOpen()) return;
          fields.image.value = added;
          drawStoryPhoto();
          ctx.toast('이야기 사진을 초안용 크기로 줄여 등록했습니다.');
        } catch (error) {
          ctx.toast(error.message, true);
        } finally {
          processing = false;
          submit.disabled = false;
          fileInput.disabled = false;
          fileInput.value = '';
        }
      }
    });
    form.append(storyDropzone, E('p', { class: 'small muted' }, '사진 파일은 초안용으로 줄여 저장합니다. 원본은 별도로 보관해 주세요.'), preview);
    drawStoryPhoto();
  }

  if (type === 'albums') {
    const previews = E('div', { class: 'photo-editor' });
    const countBar = E('div', { class: 'album-batch-bar' });
    const batchProgress = E('div', { class: 'album-batch-progress', hidden: true, 'aria-live': 'polite' });
    const draw = (focusIndex, action) => {
      countBar.replaceChildren(
        E('span', { class: 'small muted' }, `등록된 사진 ${albumImages.length} / 100장 (첫 번째 사진이 앨범·청첩장 대표 사진)`),
        albumImages.length >= 2 ? button('전체 사진 비우기', () => {
          if (!confirm(`등록된 사진 ${albumImages.length}장을 모두 비울까요?`)) return;
          albumImages.length = 0;
          draw();
          ctx.toast('앨범 사진 목록을 비웠습니다.');
        }, 'text-button small') : null);
      previews.replaceChildren(...albumImages.map((src, index) => {
        const move = target => { [albumImages[index], albumImages[target]] = [albumImages[target], albumImages[index]]; draw(target, '앞으로'); };
        const previous = button('앞으로', () => move(index - 1), 'button quiet');
        previous.disabled = index === 0;
        const next = button('뒤로', () => move(index + 1), 'button quiet');
        next.disabled = index === albumImages.length - 1;
        return E('div', { class: 'photo-edit-card' },
          image(src, `사진 ${index + 1}`),
          E('p', {}, index === 0 ? '대표 사진' : `사진 ${index + 1}`),
          E('div', { class: 'photo-edit-actions' },
            previous,
            next,
            button('대표로', () => { albumImages.unshift(...albumImages.splice(index, 1)); draw(0, '대표로'); }, 'button quiet'),
            button('사진 삭제', () => { albumImages.splice(index, 1); draw(Math.min(index, albumImages.length - 1), '사진 삭제'); }, 'button danger')));
      }));
      if (focusIndex !== undefined) {
        const card = previews.children[focusIndex];
        const target = card && [...card.querySelectorAll('button')].find(node => node.textContent === action && !node.disabled);
        (target || card?.querySelector('button:not(:disabled)') || fields.urls).focus({ preventScroll: true });
      }
    };
    const addUrls = () => {
      const urls = fields.urls.value.split(/\r?\n/).map(src => src.trim()).filter(Boolean);
      if (albumImages.length + urls.length > 100) throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
      if (urls.some(src => !safeUrl(src, { image: true }))) throw new Error('사진 주소를 확인해 주세요.');
      albumImages.push(...urls);
      fields.urls.value = '';
      draw();
    };
    form.appendChild(button('주소에서 사진 추가', () => { try { addUrls(); } catch (error) { ctx.toast(error.message, true); } }, 'button quiet'));
    const files = E('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'file-input', 'aria-label': '사진 파일 여러 장 추가' });
    const albumDropzone = createPhotoDropzone({
      input: files,
      label: '웨딩 사진 여러 장 한꺼번에 드래그·선택 (최대 100장)',
      hint: 'JPG·PNG·WEBP 사진 여러 장을 한 번에 끌어다 놓거나 파일 선택창에서 다중 선택하세요. 자동 축소·최적화됩니다.',
      multiple: true,
      onFiles: async fileList => {
        if (!fileList.length) return;
        processing = true;
        submit.disabled = true;
        files.disabled = true;
        batchProgress.hidden = false;
        try {
          const remaining = 100 - albumImages.length;
          if (remaining <= 0) throw new Error('앨범당 사진은 100장까지 추가할 수 있습니다.');
          const batch = fileList.slice(0, remaining);
          const overflowCount = fileList.length - batch.length;
          const additions = [];
          const failedNames = [];
          for (let i = 0; i < batch.length; i++) {
            const pct = Math.round(((i + 1) / batch.length) * 100);
            batchProgress.replaceChildren(
              E('span', { class: 'small' }, `🖼️ 사진 최적화 중… (${i + 1} / ${batch.length}장)`),
              E('div', { class: 'checklist-progress-track', 'aria-hidden': 'true' },
                E('span', { class: 'checklist-progress-fill', style: `width:${pct}%` })));
            try {
              additions.push(await shrinkPhoto(batch[i]));
            } catch {
              failedNames.push(batch[i].name || `${i + 1}번 파일`);
            }
          }
          if (!form.isConnected || !ctx.isDialogOpen()) return;
          if (additions.length) {
            albumImages.push(...additions);
            draw();
          }
          if (!additions.length && failedNames.length) {
            ctx.toast('JPG, PNG, WEBP 형식(20MB 이하)의 사진만 추가할 수 있습니다.', true);
          } else if (failedNames.length || overflowCount > 0) {
            const notes = [
              `사진 ${additions.length}장을 추가했습니다.`,
              failedNames.length ? `형식·용량 오류 ${failedNames.length}건 건너뜀(${failedNames.slice(0, 2).join(', ')})` : '',
              overflowCount > 0 ? `100장 한도 초과 ${overflowCount}건 제외` : ''
            ].filter(Boolean);
            ctx.toast(notes.join(' · '));
          } else {
            ctx.toast(`사진 ${additions.length}장을 한 번에 최적화해 추가했습니다.`);
          }
        } catch (error) {
          ctx.toast(error.message, true);
        } finally {
          processing = false;
          submit.disabled = false;
          files.disabled = false;
          files.value = '';
          batchProgress.hidden = true;
          batchProgress.replaceChildren();
        }
      }
    });
    const pipelineHint = E('p', { class: 'small muted album-pipeline-hint' },
      '💡 라크마 촬영본처럼 15장 이상 대량 등록할 때는 터미널에서 ',
      E('code', {}, 'npm run photos -- --src <폴더> --album lachma-2027 --title "라크마 웨딩촬영" --date 2027-02-03 --apply'),
      ' 를 실행하면 원본을 보존한 채 가벼운 웹용 파일(assets/photos/)로 등록되고 브라우저 5MB 한도를 아낄 수 있어요. 대표 사진 변경 후 ',
      E('code', {}, 'npm run share-card'),
      ' 로 카카오톡 공유 카드도 갱신됩니다.');
    form.append(albumDropzone, pipelineHint, batchProgress, countBar, previews);
    draw();
  }

  form.appendChild(E('div', { class: 'form-actions' }, button('취소', ctx.requestClose, 'button quiet'), submit));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (processing || saving) return;
    saving = true;
    submit.disabled = true;
    let attemptedNext, savedId;
    const controlStates = [...form.querySelectorAll('input,textarea,select,button')].map(node => [node, node.disabled]);
    for (const [node] of controlStates) node.disabled = true;
    try {
      const next = structuredClone(editingContent);
      const data = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value.trim()]));
      if (type === 'invitation') {
        for (const optKey of ['groomParents', 'brideParents', 'venueMapImage', 'transit', 'notice', 'contacts', 'groomAccounts', 'brideAccounts', 'rsvpUrl']) {
          if (!data[optKey]) delete data[optKey];
        }
        next.invitation = data;
      } else {
        const id = item?.id || crypto.randomUUID();
        savedId = id;
        let record = { ...data, id };
        if (type === 'albums') {
          const images = [...albumImages, ...data.urls.split(/\r?\n/).map(src => src.trim()).filter(Boolean)];
          record = { id, title: data.title, date: data.date, body: data.body, images };
        }
        if (type === 'honeymoon') {
          record.budget = data.budget === '' ? null : Number(data.budget);
          record.plan = {
            ...editedPlan,
            stays: stayFields.read(),
            dateBasis: stayFields.basis(),
            costs: Object.fromEntries(Object.keys(COST_LABELS).map(key => [key, data[`cost_${key}`] === '' ? null : Number(data[`cost_${key}`])])),
            ...extraFields.read()
          };
          for (const key of Object.keys(COST_LABELS)) delete record[`cost_${key}`];
          for (const key of ['lodgingNotes', 'itinerary', 'transport']) record.plan[key] = data[`plan_${key}`];
          record.plan.quote = quoteFields.read();
          for (const key of Object.keys(record)) if (key.startsWith('plan_') || key.startsWith('quote_')) delete record[key];
        }
        const index = next[type].findIndex(value => value.id === id);
        if (index === -1) next[type].push(record);
        else next[type][index] = record;
      }
      attemptedNext = next;
      await ctx.setDraft(next, editingContent, approvedRaw);
      let filterResetNotice = false;
      if (type === 'honeymoon' && savedId) {
        const savedTrip = ctx.getContent().honeymoon.find(value => value.id === savedId);
        if (savedTrip && hasActiveTripFilters(ctx.isGuestMode()) && !matchesAllTripFilters(ctx, savedTrip)) {
          resetTripFilters();
          filterResetNotice = true;
        }
      }
      ctx.closeDialog();
      ctx.render();
      if (type !== 'invitation') ctx.focusRecord(type, savedId);
      ctx.toast(filterResetNotice ? '이 기기에 초안을 저장했습니다. 방금 저장한 후보를 표시하기 위해 필터를 해제했습니다.' : '이 기기에 초안을 저장했습니다.');
    } catch (error) {
      ctx.toast(error.message, true);
      if (error instanceof StorageConflict) {
        ctx.beginConflictReview({
          key: ctx.DRAFT_KEY,
          base: editingContent,
          next: attemptedNext,
          keepSaved: () => {
            if (!confirm('현재 입력을 버리고 다른 탭의 저장본을 불러올까요?')) return;
            try { ctx.syncDraftFromStorage(); ctx.closeDialog(); ctx.render(); } catch (cause) { ctx.toast(cause.message, true); }
          },
          saveLocal: raw => { approvedRaw = raw; form.requestSubmit(); }
        });
      }
    } finally {
      saving = false;
      submit.disabled = false;
      for (const [node, disabled] of controlStates) node.disabled = disabled;
    }
  });
  const snapshot = () => JSON.stringify({
    values: Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.type === 'checkbox' ? input.checked : input.value])),
    images: albumImages,
    stays: stayFields?.read(),
    basis: stayFields?.basis()
  });
  const initial = snapshot();
  if (ctx.showDialog(titles[type], form)) {
    ctx.setEditorState({ isDirty: () => processing || saving || snapshot() !== initial, isSaving: () => saving });
  }
}
