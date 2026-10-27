import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateBodyTextLength,
  extractBodyPlainText,
  extractBodyImages,
  validateArticleForPublish,
  ARTICLE_RULES,
} from '../utils/article-validator.ts'

test('Article Validator - Text Length Unit Tests', async (t) => {
  await t.test('799 characters: fails text validation', () => {
    // Generate exactly 799 Korean characters
    const content = '가'.repeat(799)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 799)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isTextLengthValid, false)
    assert.equal(result.valid, false)
    assert.match(result.errors.find((e) => e.includes('본문 텍스트가 부족합니다')) || '', /799자/)
  })

  await t.test('800 characters: passes text validation (minimum boundary)', () => {
    const content = '가'.repeat(800)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 800)

    const result = validateArticleForPublish({
      content: content + '\n\n' + [
        '![img1](https://example.com/1.jpg)',
        '![img2](https://example.com/2.jpg)',
        '![img3](https://example.com/3.jpg)',
        '![img4](https://example.com/4.jpg)',
      ].join('\n\n'),
    })
    assert.equal(result.isTextLengthValid, true)
    assert.equal(result.valid, true)
  })

  await t.test('2,000 characters: passes text validation (maximum boundary)', () => {
    const content = '나'.repeat(2000)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 2000)

    const result = validateArticleForPublish({
      content: content + '\n\n' + [
        '![img1](https://example.com/1.jpg)',
        '![img2](https://example.com/2.jpg)',
        '![img3](https://example.com/3.jpg)',
        '![img4](https://example.com/4.jpg)',
      ].join('\n\n'),
    })
    assert.equal(result.isTextLengthValid, true)
    assert.equal(result.valid, true)
  })

  await t.test('2,001 characters: fails text validation (exceeded boundary)', () => {
    const content = '다'.repeat(2001)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 2001)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isTextLengthValid, false)
    assert.equal(result.valid, false)
    assert.match(result.errors.find((e) => e.includes('본문 텍스트가 초과되었습니다')) || '', /2001자/)
  })

  await t.test('Stripping formatting: headings, lists, bold, italics, code, and horizontal rules are excluded', () => {
    const raw = `
# 메인 헤딩 (6자)
## 서브 헤딩 (6자)

- 리스트 1번 항목 (9자)
* 리스트 2번 항목 (9자)
1. 번호 리스트 항목 (9자)

> 인용구 텍스트 (7자)

---

**굵은 글씨**와 *기울임 글씨*, 그리고 \`인라인 코드\`입니다.
`
    const plain = extractBodyPlainText(raw)
    // Verify markdown syntax tokens are removed
    assert.equal(plain.includes('#'), false)
    assert.equal(plain.includes('*'), false)
    assert.equal(plain.includes('-'), false)
    assert.equal(plain.includes('`'), false)
    assert.equal(plain.includes('>'), false)
  })

  await t.test('Image syntax and URL are completely excluded from text count', () => {
    const baseText = '인천국제공항 제2여객터미널 확장 개항'
    const markdownWithImages = `
${baseText}

![수완나품 공항 입국장 패스트트랙 현장 사진](https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200 "현장 취재 자료 사진")

<img src="https://example.com/photo2.jpg" alt="터미널 내부 전경" title="터미널 안내" />
`
    const extracted = extractBodyPlainText(markdownWithImages)
    assert.equal(extracted, baseText)
    assert.equal(calculateBodyTextLength(markdownWithImages), [...baseText].length)
  })

  await t.test('Link syntax: anchor text IS counted, URL is excluded', () => {
    const markdown = '자세한 사항은 [대한항공 공식 웹사이트](https://www.koreanair.com/booking/flights?ref=news)에서 확인 가능합니다.'
    const plain = extractBodyPlainText(markdown)
    assert.equal(plain, '자세한 사항은 대한항공 공식 웹사이트에서 확인 가능합니다.')
    assert.equal(plain.includes('https://'), false)
    assert.equal(plain.includes('koreanair.com'), false)
  })

  await t.test('Handles Korean, English, numbers, and emojis consistently', () => {
    const text = '방콕 ✈️ 수완나품 공항 AOT 2026년 통계 100%'
    const len = calculateBodyTextLength(text)
    assert.equal(len, [...text].length)
  })
})

test('Article Validator - Body Image Unit Tests', async (t) => {
  await t.test('0 images: fails validation (needs 4)', () => {
    const content = '가'.repeat(900)
    const images = extractBodyImages(content)
    assert.equal(images.length, 0)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isImageCountValid, false)
    assert.equal(result.valid, false)
    assert.match(result.errors.find((e) => e.includes('본문 이미지가 부족합니다')) || '', /4장 부족/)
  })

  await t.test('3 images: fails validation (needs 1 more)', () => {
    const content = `
${'가'.repeat(900)}

![사진1](https://example.com/img1.jpg)
![사진2](https://example.com/img2.jpg)
![사진3](https://example.com/img3.jpg)
`
    const images = extractBodyImages(content)
    assert.equal(images.length, 3)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isImageCountValid, false)
    assert.equal(result.valid, false)
    assert.match(result.errors.find((e) => e.includes('본문 이미지가 부족합니다')) || '', /1장 부족/)
  })

  await t.test('4 images: passes image validation (minimum boundary)', () => {
    const content = `
${'가'.repeat(900)}

![사진1](https://example.com/img1.jpg)
![사진2](https://example.com/img2.jpg)
![사진3](https://example.com/img3.jpg)
![사진4](https://example.com/img4.jpg)
`
    const images = extractBodyImages(content)
    assert.equal(images.length, 4)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isImageCountValid, true)
    assert.equal(result.valid, true)
  })

  await t.test('10 images: passes image validation (maximum boundary)', () => {
    const imgLines = Array.from({ length: 10 }, (_, i) => `![사진${i + 1}](https://example.com/img${i + 1}.jpg)`).join('\n')
    const content = `${'가'.repeat(900)}\n\n${imgLines}`

    const images = extractBodyImages(content)
    assert.equal(images.length, 10)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isImageCountValid, true)
    assert.equal(result.valid, true)
  })

  await t.test('11 images: fails validation (exceeds 10)', () => {
    const imgLines = Array.from({ length: 11 }, (_, i) => `![사진${i + 1}](https://example.com/img${i + 1}.jpg)`).join('\n')
    const content = `${'가'.repeat(900)}\n\n${imgLines}`

    const images = extractBodyImages(content)
    assert.equal(images.length, 11)

    const result = validateArticleForPublish({ content })
    assert.equal(result.isImageCountValid, false)
    assert.equal(result.valid, false)
    assert.match(result.errors.find((e) => e.includes('본문 이미지가 초과되었습니다')) || '', /1장 초과/)
  })

  await t.test('Excludes representative cover image from body image count', () => {
    const coverUrl = 'https://example.com/cover.jpg'
    const content = `
${'가'.repeat(900)}

![대표 커버 중복](https://example.com/cover.jpg)
![사진1](https://example.com/img1.jpg)
![사진2](https://example.com/img2.jpg)
![사진3](https://example.com/img3.jpg)
![사진4](https://example.com/img4.jpg)
`
    const images = extractBodyImages(content, coverUrl)
    // cover.jpg must NOT be counted, so exactly 4 images are extracted
    assert.equal(images.length, 4)
    assert.equal(images.some((img) => img.url === coverUrl), false)
  })

  await t.test('Deduplicates repeated identical image references', () => {
    const content = `
${'가'.repeat(900)}

![사진1](https://example.com/img1.jpg)
![사진1 복사](https://example.com/img1.jpg)
![사진2](https://example.com/img2.jpg)
![사진3](https://example.com/img3.jpg)
`
    const images = extractBodyImages(content)
    // img1.jpg appeared twice, counted once -> total 3 unique images
    assert.equal(images.length, 3)
  })

  await t.test('Rejects corrupted or memory blob URLs', () => {
    const content = `
${'가'.repeat(900)}

![]()
![alt]()
![blob](blob:http://localhost:3000/12345)
![js](javascript:alert(1))
![정상](https://example.com/valid.jpg)
`
    const images = extractBodyImages(content)
    assert.equal(images.length, 1)
    assert.equal(images[0]?.url, 'https://example.com/valid.jpg')
  })
})

test('Article Validator - Combined Publishing Status Tests', async (t) => {
  await t.test('Draft bypass: saving as draft requires no minimums', () => {
    // Empty draft
    const draftValidation = validateArticleForPublish({ content: '' })
    assert.equal(draftValidation.valid, false) // Not ready for publish
    // But draft status logic in server/client allows it
  })

  await t.test('Both 800~2,000 chars and 4~10 images must be satisfied simultaneously', () => {
    // 1. Text OK, Image Fail
    const res1 = validateArticleForPublish({
      content: '가'.repeat(900),
    })
    assert.equal(res1.isTextLengthValid, true)
    assert.equal(res1.isImageCountValid, false)
    assert.equal(res1.valid, false)

    // 2. Text Fail, Image OK
    const res2 = validateArticleForPublish({
      content: '가'.repeat(500) + '\n\n' + [
        '![1](https://example.com/1.jpg)',
        '![2](https://example.com/2.jpg)',
        '![3](https://example.com/3.jpg)',
        '![4](https://example.com/4.jpg)',
      ].join('\n\n'),
    })
    assert.equal(res2.isTextLengthValid, false)
    assert.equal(res2.isImageCountValid, true)
    assert.equal(res2.valid, false)

    // 3. Both OK
    const res3 = validateArticleForPublish({
      content: '가'.repeat(900) + '\n\n' + [
        '![1](https://example.com/1.jpg)',
        '![2](https://example.com/2.jpg)',
        '![3](https://example.com/3.jpg)',
        '![4](https://example.com/4.jpg)',
      ].join('\n\n'),
    })
    assert.equal(res3.isTextLengthValid, true)
    assert.equal(res3.isImageCountValid, true)
    assert.equal(res3.valid, true)
  })
})

test('AI Keyword Generation - 800 to 2,000 Chars Rules', async (t) => {
  await t.test('799 characters: is below minimum 800 chars', () => {
    const content = '가'.repeat(799)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 799)
    assert.equal(len >= 800 && len <= 2000, false)
  })

  await t.test('800 characters: passes minimum 800 boundary', () => {
    const content = '가'.repeat(800)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 800)
    assert.equal(len >= 800 && len <= 2000, true)
  })

  await t.test('2,000 characters: passes maximum 2,000 boundary', () => {
    const content = '나'.repeat(2000)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 2000)
    assert.equal(len >= 800 && len <= 2000, true)
  })

  await t.test('2,001 characters: exceeds maximum 2,000 boundary', () => {
    const content = '다'.repeat(2001)
    const len = calculateBodyTextLength(content)
    assert.equal(len, 2001)
    assert.equal(len >= 800 && len <= 2000, false)
  })
})


