/**
 * Represents the span from one integer to a higher or equal integer.
 */
export default class Range {
  /**
   * Creates a new Range instance.
   * @param {!Array.<number>} rangeArray Array of start and end value. Start value should not be greater than end value.
   */
  constructor(rangeArray) {
    this._rangeArray = rangeArray;
  }

  /**
   * @returns {!number} The start number of the range. Lower or equal to end.
   */
  get start() {
    return this._rangeArray[0];
  }

  /**
   * @returns {!number} The end number of the range. Higher or equal to start.
   */
  get end() {
    return this._rangeArray[1];
  }

  /**
   * @returns {!number} The arithmetic mean of start and end value. Can be a fraction.
   */
  get center() {
    return Math.floor((this.start + this.end) / 2);
  }


  /**
   * @param {!number} value The number to check whether it's in the range.
   * @returns {!boolean} Whether the given number is inside this range, i.e. if it's not lower than the start value and not higher than the end value.
   */
  contains(value) {
    return this.start <= value && value <= this.end;
  }

  /**
   * @param {!Range} range Another Range object.
   * @returns {!boolean} Whether this range overlaps with the given one.
   */
  overlapsWith(range) {
    return range.end > this.start && range.start < this.end;
  }

  /**
   * @param {!Array.<Range>} ranges An array of Range objects.
   * @returns {!boolean} Whether this range overlaps with any of the given ones.
   */
  overlapsWithOneOf(ranges) {
    return ranges.some(range => this.overlapsWith(range));
  }

  /**
   * @param {!Range} range Another Range object.
   * @returns {!boolean} Whether this range is exactly next to the given one. If so, the lower range's end value is by 1 lower than the higher range's start value.
   */
  isAdjacentTo(range) {
    return range.end + 1 === this.start || this.end + 1 === range.start;
  }

  /**
   * @param {!Range} range The other range to merge with.
   * @returns {!Range} A new range that covers both the initial and the other range.
   */
  getRangeMergedWith(range) {
    return new Range([Math.min(this.start, range.start), Math.max(this.end, range.end)]);
  }

  /**
   * @returns {!string} Textual representation of this range.
   */
  toString() {
    return this.start === this.end ? this.start.toString() : `${this.start}…${this.end}`;
  }


  /**
   * Merge specified Range objects. Asserts that ranges don't overlap and that all ranges are valid (start<=end).
   * @param {!Array.<Range>} ranges Range objects to merge into as few ranges as possible.
   * @returns {!Array.<Range>} Merged ranges.
   */
  static getMergedRanges(ranges) {
    const mergedRanges = ranges.map(range => new Range([range.start, range.end]));

    // ranges to merge
    mergedRanges.forEach((range, index, arr) => {
      const mergableRangeIndex = arr.findIndex(otherRange => otherRange.isAdjacentTo(range));

      if (mergableRangeIndex !== -1) {
        // replace current range with merged range and delete other range
        arr[index] = mergedRanges[mergableRangeIndex].getRangeMergedWith(range);
        arr.splice(mergableRangeIndex, 1);
      }
    });

    return mergedRanges;
  }
}
