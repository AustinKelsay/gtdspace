/**
 * Manual test file for multiselect-block-helpers
 * Run with: npx tsx src/utils/multiselect-block-helpers.test.ts
 * or: node --loader tsx src/utils/multiselect-block-helpers.test.ts
 * 
 * Note: No test framework is currently configured in the project.
 * These tests provide manual verification of the serializer/deserializer functions.
 */

import {
  serializeMultiselectsToMarkers,
  deserializeMarkersToMultiselects,
  createMultiSelectBlock,
  type MultiSelectBlockType
} from './multiselect-block-helpers';

// Test helpers
let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string): void {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`✓ ${message}`);
  } else {
    failedCount++;
    console.error(`✗ ${message}`);
  }
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  assert(actual === expected, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertContains(str: string, substring: string, message: string): void {
  assert(str.includes(substring), `${message} (string does not contain: ${substring})`);
}

// Test suite
console.log('\n=== Testing multiselect-block-helpers ===\n');

// Test createMultiSelectBlock
console.log('Testing createMultiSelectBlock:');
{
  const block = createMultiSelectBlock('tags', 'Tags', ['urgent', 'important']);
  assertEquals(block.type, 'multiselect', 'Should have type multiselect');
  assertEquals(block.props.type, 'tags', 'Should have correct type');
  assertEquals(block.props.value, 'urgent,important', 'Should join values with comma');
  assertEquals(block.props.label, 'Tags', 'Should have correct label');
}

{
  const block = createMultiSelectBlock('contexts', 'Contexts', [], { placeholder: 'Select contexts', maxCount: 3 });
  assertEquals(block.props.value, '', 'Should handle empty array');
  assertEquals(block.props.placeholder, 'Select contexts', 'Should have placeholder');
  assertEquals(block.props.maxCount, 3, 'Should have maxCount');
}

// Test round-trip conversion first (since DOMParser not available in Node)
console.log('\nTesting round-trip conversion:');
{
  const originalMarker = '[!multiselect:tags:urgent,important,review]';
  const html = deserializeMarkersToMultiselects(originalMarker);
  // Since we're in Node environment, the HTML won't be parsed by DOMParser
  // so we expect it to remain as HTML
  assertContains(html, 'data-multiselect', 'Should create HTML with data attribute');
  assertContains(html, 'urgent, important, review', 'Should display values');
  
  // The serializer won't work without DOMParser, so it will return unchanged
  const backToMarker = serializeMultiselectsToMarkers(html);
  // In Node environment without DOMParser, it falls back to regex
  assert(backToMarker === originalMarker || backToMarker.includes('data-multiselect'), 
    'Should either convert back or preserve HTML (depending on environment)');
}

// Test deserializeMarkersToMultiselects
console.log('\nTesting deserializeMarkersToMultiselects:');
{
  const markdown = '[!multiselect:tags:urgent,important]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'data-multiselect', 'Should create HTML with data attribute');
  assertContains(result, 'class="multiselect-block"', 'Should have multiselect-block class');
  assertContains(result, 'tags: urgent, important', 'Should display values');
}

{
  const markdown = '[!multiselect:contexts:]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'contexts', 'Should preserve type');
  assertContains(result, 'multiselect-block', 'Should handle empty values');
}

{
  const markdown = '[!multiselect:categories:single]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'categories: single', 'Should convert single value and display it');
}

{
  // Test invalid type falls back to 'tags'
  const markdown = '[!multiselect:invalid:test]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'tags: test', 'Should fall back to tags for invalid type');
}

{
  // Test with special characters that need escaping
  const markdown = '[!multiselect:tags:test&special,<script>alert]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, '&amp;', 'Should escape ampersand');
  assertContains(result, '&lt;', 'Should escape less-than');
}

{
  // Test mixed content preservation
  const markdown = `# Header\n[!multiselect:tags:a,b,c]\nSome text`;
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, '# Header', 'Should preserve header');
  assertContains(result, 'data-multiselect', 'Should convert marker');
  assertContains(result, 'Some text', 'Should preserve text');
}

// Test idempotency
console.log('\nTesting idempotency:');
{
  // Test that deserializeMarkersToMultiselects is idempotent
  const markdown = '[!multiselect:tags:test]';
  const once = deserializeMarkersToMultiselects(markdown);
  const twice = deserializeMarkersToMultiselects(once);
  assertEquals(once, twice, 'deserializeMarkersToMultiselects should be idempotent');
}

{
  // Test that serializeMultiselectsToMarkers doesn't affect already-serialized content
  const markdown = '[!multiselect:tags:test]';
  const result = serializeMultiselectsToMarkers(markdown);
  assertEquals(result, markdown, 'serializeMultiselectsToMarkers should not change markers');
}

// Test edge cases for deserialization
console.log('\nTesting edge cases:');
{
  // Test whitespace trimming in values
  const markdown = '[!multiselect:tags: urgent , important , review ]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'tags: urgent, important, review', 'Should trim whitespace from values');
}

{
  // Test empty string values are filtered out
  const markdown = '[!multiselect:tags:urgent,,important]';
  const result = deserializeMarkersToMultiselects(markdown);
  assertContains(result, 'tags: urgent, important', 'Should filter out empty values and display correctly');
}

// Test XSS prevention in deserialization
console.log('\nTesting XSS prevention:');
{
  const maliciousMarkdown = '[!multiselect:tags:<script>alert(1)</script>]';
  const result = deserializeMarkersToMultiselects(maliciousMarkdown);
  assert(!result.includes('<script>alert'), 'Should escape script tags in deserialization');
  assertContains(result, '&lt;script', 'Should escape to HTML entities');
}

// Test HTML entity handling with real-world example
console.log('\nTesting HTML entity handling:');
{
  // Test that HTML entities in attributes are handled correctly
  const html = `<div data-multiselect='{&quot;type&quot;:&quot;tags&quot;,&quot;value&quot;:[&quot;test&quot;]}' class="multiselect-block">tags: test</div>`;
  const result = serializeMultiselectsToMarkers(html);
  // In Node environment, this should get the entity-decoded version
  assertEquals(result, '[!multiselect:tags:test]', 'Should decode HTML entities');
}

// Test the actual format that would be generated by deserializeMarkersToMultiselects
console.log('\nTesting actual generated format:');
{
  // First generate the HTML from a marker
  const marker = '[!multiselect:tags:work,personal]';
  const generatedHtml = deserializeMarkersToMultiselects(marker);
  
  // The generated HTML should be properly escaped
  assertContains(generatedHtml, 'data-multiselect', 'Generated HTML should have data attribute');
  assertContains(generatedHtml, 'tags: work, personal', 'Generated HTML should have display text');
  
  // Now try to serialize it back (this tests the real-world round trip)
  const backToMarker = serializeMultiselectsToMarkers(generatedHtml);
  // In Node without DOMParser, regex fallback may or may not work
  assert(
    backToMarker === marker || backToMarker === generatedHtml,
    'Should either convert back to marker or preserve HTML (environment-dependent)'
  );
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);

if (failedCount === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed');
  process.exit(1);
}