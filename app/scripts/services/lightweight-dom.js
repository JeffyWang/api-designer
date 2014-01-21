/**
 * The lightweight-dom module provides a DOM-like API over raml documents. For
 * performance reasons, this DOM is lazy; navigation from one node to
 * another involves parsing RAML rather than walking an actual DOM.
 *
 * The parsing code is built on lightweight-parse, for which this module is
 * intended to be a facade.
 * It is designed for editor purposes and not intended to be a compliant
 * RAML parser, but an MVP implementation designed to make things like reliably
 * showing the right shelf items a matter not of string parsing but of RAML DOM
 * inspection/traversal.
 *
 * Since this is a designer DOM, it attempts to return as much data as possible
 * even if a document is correctly formed. To this end, parents/children are
 * defined as having a less than/greater than tab count. For example:
 * Foo:
 *     Bar:
 *           Baz:
 * The child of Foo is Bar and the child of Bar is Baz. The reverse traversal
 * is Baz to Bar to Foo. So, it is thus up to client code to detect proper
 * nesting by inspecting nodes' tabCount. For example, code could autocorrect
 * users' code, show an error, or ignore the issue and let the user fix the
 * errors themselves.
 */
'use strict';

angular.module('lightweightDOM', ['lightweightParse'])
.factory('getNode', function getNodeFactory(getLineIndent, isArrayStarter, extractKey, extractValue, isCommentStarter) {
  /**
   * Factory function that creates a lazydom instance from an editor code line
   * @param editor The codemirror editor containing the RAML document
   * @returns {Object} the lazydom element for the current cursor position.
   */
  return function getNode(editor, lineNum) {

    /**
     * @param editor The CodeMirror raml editor containing the RAML document
     * @param lineNum The line to read the node from, or the current cursor
     *                line if not specified.
     * @returns {LazyNode} Instance of LazyNode at given line, or null if the
     * line is not a number or out of editor bounds.
     */
    function createNode(editor, lineNum) {
      //If the line number is a number but out of bounds then we return null.
      //If the line number is not a number, we use the current editor line.
      var codeLineNum = typeof lineNum === 'number' ? lineNum : editor.getCursor().line;
      if (editor.getLine(codeLineNum) === undefined) {
        return null;
      }
      return new LazyNode(editor, codeLineNum);
    }

    //region LazyNode Class Definition
    /**
     * Builds a new lazy node from the given content.
     * @param editor The CodeMirror raml editor containing the RAML document
     * @param lineNum The line to read the node from.
     * @constructor
     * @throws If lineNum is out of range of the editor's contents
     */
    function LazyNode(editor, lineNum) {
      this.lineNum = lineNum;
      this.editor = editor;
      this.line = editor.getLine(lineNum);

      this.isComment = isCommentStarter(this.line);
      this.isEmpty = this.line.trim() === '';

      this.tabCount = getTabCount(editor, lineNum, this.isEmpty);
      if (!this.isComment) {
        this.key = extractKey(this.line);
        this.value = extractValue(this.line);
        this.isArrayStarter = isArrayStarter(this.line);
      }
    }

    /**
     * Special case: If a node is non-structural, e.g. an empty line or a comment, then by
     * contract with upper layers, we use the cursor position if it is at the line. This
     * matches the behavior of the shelf and autocomplete features. It is, admittedly, a little
     * bit obscure but based on all editor use cases we've looked at, it works.
     *
     * @param editor The CodeMirror raml editor containing the RAML document
     * @param lineNum The line to read the node from. Current editor cursor line if not specified.
     * @returns {Number} Number of tabs at line or at cursor
     */
    function getTabCount(editor, lineNum, isEmpty) {
      //Special case: If the current line is where the cursor is, AND
      //the line is empty:
      var line = editor.getLine(lineNum);
      if (isEmpty) {
        var cursor = editor.getCursor();
        if (cursor.line === lineNum) {
          line = ((new Array(cursor.ch + 1)).join(' ')); //<- Line containing spaces up to cursor
        }
      }
      return getLineIndent(line).tabCount;
    }

    /**
     * @returns {LazyNode} The next structural sibling node, or null.
     */
    LazyNode.prototype.getNextSibling = function getNextSibling() {
      //Calculate the correct tab indent for the next sibling:
      //For non-array nodes, the indent is identical
      //For array node, the indent is one greater
      var nextLineNum = this.lineNum;
      while(true) {
        var nextNode = getNode(editor, ++nextLineNum);
        if (nextNode === null) {
          return null;
        }
        //Skip empty elements and comments
        if (!nextNode.getIsStructural()) {
          continue;
        }
        //If the next node is at our tab level it is always a sibling
        if (nextNode.tabCount === this.tabCount) {
          return nextNode;
        }
        //Array case:
        //Previous element is non-starter in previous array:
        if (this.isArrayStarter && !nextNode.isArrayStarter && nextNode.tabCount === this.tabCount + 1) {
          return nextNode;
        }
        //Previous element is starter in previous array:
        if (!this.isArrayStarter && nextNode.isArrayStarter && nextNode.tabCount === this.tabCount - 1) {
          return nextNode;
        }

        //If we end up at a lower tab count, then there are no more siblings possible
        if (nextNode.tabCount < this.tabCount)  {
          return null;
        }
      }
    };

    /**
     * @returns {LazyNode} The previous structural sibling node, or null.
     */
    LazyNode.prototype.getPreviousSibling = function getPreviousSibling() {
      //Calculate the correct tab indent for the previous sibling:
      //For non-array nodes, the indent is identical
      //For array node, the indent is one less OR an element that is an array starter
      var prevLineNum = this.lineNum;
      while(true) {
        prevLineNum -= 1;
        var prevNode = getNode(editor, prevLineNum);
        if (prevNode === null) {
          return null;
        }
        //Ignore comments and empty lines
        if (!prevNode.getIsStructural()) {
          continue;
        }
        //If the previous node is at our tab level it is always a sibling
        if (prevNode.tabCount === this.tabCount) {
          return prevNode;
        }
        //Array cases:
        //Previous element is non-starter in previous array:
        if (this.isArrayStarter && !prevNode.isArrayStarter && prevNode.tabCount === this.tabCount + 1) {
          return prevNode;
        }
        //Previous element is starter in previous array:
        if (!this.isArrayStarter && prevNode.isArrayStarter && prevNode.tabCount === this.tabCount - 1) {
          return prevNode;
        }

        //If we end up at a lower tab count, then there are no more siblings possible
        if (prevNode.tabCount < this.tabCount)  {
          return null;
        }
      }
    };

    /**
     * @returns {LazyNode} The first structural child node, or null.
     */
    LazyNode.prototype.getFirstChild = function getFirstChild() {
      var nextNodeTabCount = this.tabCount + (this.isArrayStarter ? 2 : 1);
      var nextLineNum = this.lineNum;
      while(true) {
        var nextNode = getNode(editor, ++nextLineNum);
        if (nextNode === null) {
          return null;
        }
        //If we end up at the same or lower tab count, then there are no children possible
        if (nextNode.tabCount < nextNodeTabCount) {
          return null;
        }
        //look at any node at or beyond the tabCount since the document could be malformed,
        //but we still want to return children.
        if (nextNode.tabCount >= nextNodeTabCount && nextNode.getIsStructural()) {
          return nextNode;
        }
      }
    };

    /**
     * @returns {LazyNode} The parent node, or null if this is a root node
     */
    LazyNode.prototype.getParent = function getParent() {
      //For members of arrays that aren't the first array element, the parent is
      //two tabs over, e.g
      //documentation:
      //  - title: foo
      //    content: bar <- 2 tabs over from parent
      var parentNodeTabCount = this.tabCount - ((!this.isArrayStarter && this.getIsInArray()) ? 2 : 1);
      var prevLineNum = this.lineNum;
      while(true) {
        var prevNode = getNode(editor, --prevLineNum);
        if (prevNode === null) {
          return null;
        }
        //look at any node at or beyond the tabCount since the document could be malformed,
        //but we still want to return a parent if we can find one.
        if (prevNode.tabCount <= parentNodeTabCount && prevNode.getIsStructural()) {
          return prevNode;
        }
      }
    };

    /**
     * @returns {[LazyNode]} The current node plus any nodes at the same tab
     * level with the same parent. For arrays, returns all members of the
     * node's array. Array consists first of current node, then previous neighbors
     * then next neighbors.
     */
    LazyNode.prototype.getSelfAndNeighbors = function getSelfAndNeighbors() {
      var nodes = [];
      var inArray = this.getIsInArray();
      var node = this;
      while (node && node.getIsInArray() === inArray) {
        nodes.push(node);
        if (node.isArrayStarter) {
          break;
        }
        node = node.getPreviousSibling();
      }
      node = this.getNextSibling();
      while (node && !node.isArrayStarter && node.getIsInArray() === inArray) {
        nodes.push(node);
        node = node.getNextSibling();
      }
      return nodes;
    };

    /**
     * @returns {Boolean} Whether or not the node is in an array
     */
    LazyNode.prototype.getIsInArray = function getIsInArray() {
      //Walk previous siblings until we find one that starts an array, or we run
      //out of siblings.
      //Note: We don't use recursion here since JS has a low recursion limit of 1000
      if (this.isArrayStarter) {
        return true;
      }
      //Move up until we find a node one tab count less: If it is
      //an array starter, we are in an array
      var node = this.getPreviousSibling();
      while(node && node.tabCount >= this.tabCount) {
        node = node.getPreviousSibling();
      }
      return !!(node && node.isArrayStarter && (node.tabCount === this.tabCount - 1));
    };

    /**
     * @returns {Array} Returns array containing all parent nodes of
     * this node, with the direct parent being the last element in the
     * array.
     */
    LazyNode.prototype.getPath = function getPath() {
      var path = [];
      var node = this.getParent();
      while(node) {
        path.unshift(node);
        node = node.getParent();
      }
      return path;
    };

    /**
     * @return {Boolean} Whether this node is neither a comment nor consists of
     * nothing but whitespace
     */
    LazyNode.prototype.getIsStructural = function getIsStructural() {
      return !this.isComment && !this.isEmpty;
    };

    /**
     * Executes the testFunc against this node and its parents, moving up the
     * tree until no more nodes are found.  Will halt if the test function
     * returns true.
     * @param testFunc Function to execute against current node and parents
     * @returns {LazyNode} The first node where testFunc returns true, or null.
     */
    LazyNode.prototype.selfOrParent = function selfOrParent(testFunc) {
      return this.first(this.getParent, testFunc);
    };

    /**
     * Executes the testFunc against this node and its prior siblings. Will
     * halt if the test function returns true.
     * @param testFunc Function to execute against current node and parents
     * @returns {LazyNode} The first node where testFunc returns true, or null.
     */
    LazyNode.prototype.selfOrPrevious = function selfOrPrevious(testFunc) {
      return this.first(this.getPreviousSibling, testFunc);
    };

    /**
     * Executes the test function against all nodes, including the current one,
     * returned by nextNodeFunc. Halts when no more nodes are found or testFunc
     * returns a truthy value.
     * @param nextNodeFunc Function that returns the next node to search.
     * @param testFunc Function that returns a node that matches a filter.
     * @returns {LazyNode} The first node where testFunc returns true, or null.
     */
    LazyNode.prototype.first = function first(nextNodeFunc, testFunc) {
      var node = this;
      while(node) {
        if (testFunc(node)) {
          return node;
        }
        node = nextNodeFunc.apply(node);
      }
      return null;
    };

    //endregion

    return createNode(editor, lineNum);
  };
});
