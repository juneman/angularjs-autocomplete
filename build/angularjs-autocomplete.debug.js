(function(){
  'use strict';

  // return dasherized from  underscored/camelcased string
  var dasherize = function(string) {
    return string.replace(/_/g, '-').
      replace(/([a-z])([A-Z])/g, function(_,$1, $2) {
        return $1+'-'+$2.toLowerCase();
      });
  };

  // accepted attributes
  var autoCompleteAttrs = [
    'ngModel', 'valueChanged', 'source', 'pathToData', 'minChars',
    'defaultStyle', 'valueProperty', 'displayProperty'
  ];

  // build autocomplet-div tag with input and select
  var buildACDiv = function(controlEl, attrs) {
    var acDiv = document.createElement('auto-complete-div');
    var controlBCR = controlEl.getBoundingClientRect();
    acDiv.controlEl = controlEl;

    var inputEl = document.createElement('input');
    attrs.ngDisabled && 
      inputEl.setAttribute('ng-disabled', attrs.ngDisabled);
    acDiv.appendChild(inputEl);

    var ulEl = document.createElement('ul');
    acDiv.appendChild(ulEl);

    autoCompleteAttrs.map(function(attr) {
      attrs[attr] && acDiv.setAttribute(dasherize(attr), attrs[attr]);
    });
    acDiv.style.position = 'absolute';
    acDiv.style.top = 0;
    acDiv.style.left = 0;
    acDiv.style.display = 'none';
    return acDiv;
  };

  var compileFunc = function(tElement, tAttrs)  {
    tElement[0].style.position = 'relative';

    var controlEl = tElement[0].querySelector('input, select');

    tAttrs.valueProperty = tAttrs.valueProperty || 'id';
    tAttrs.displayProperty = tAttrs.displayProperty || 'value';
    tAttrs.ngModel = controlEl.getAttribute('ng-model');

    // 1. build <auto-complete-div>
    var acDiv = buildACDiv(controlEl, tAttrs);
    tElement[0].appendChild(acDiv);

    // 2. respond to click by hiding option tags
    controlEl.addEventListener('mouseover', function() {
      controlEl.firstChild && (controlEl.firstChild.style.display = 'none');
    });
    controlEl.addEventListener('mouseout', function() {
      controlEl.firstChild && (controlEl.firstChild.style.display = '');
    });
    controlEl.addEventListener('click', function() {
      if (!controlEl.disabled) {
        acDiv.style.display = 'block';
        var controlBCR = controlEl.getBoundingClientRect();
        var acDivInput = acDiv.querySelector('input');
        acDiv.style.width = controlBCR.width + 'px';
        acDivInput.style.width = (controlBCR.width - 30) + 'px';
        acDivInput.style.height = controlBCR.height + 'px';
        acDivInput.focus();
      }
    });


  }; // compileFunc

  angular.module('angularjs-autocomplete',[]);
  angular.module('angularjs-autocomplete').
    directive('autoComplete', function() {
      return { compile: compileFunc };
    });
})();

(function(){
  'use strict';
  var $timeout, $filter, $compile, AutoComplete;

  var showLoading = function(ulEl, show) {
    if (show) {
      ulEl.innerHTML = '<li class="loading"> Loading </li>'; 
    } else {
      ulEl.querySelector('li.loading') &&
        ulEl.querySelector('li.loading').remove();
    }
  };

  var addListElements = function(scope, data) {
    var inputEl = scope.inputEl, ulEl = scope.ulEl;
    var displayText;
    data.forEach(function(el) {
      var liEl = document.createElement('li');
      var displayText = typeof el == 'object' ?
        el[scope.displayProperty] : el;
      liEl.innerHTML = displayText;
      liEl.object = el;
      liEl.objectValue = el[scope.valueProperty];
      ulEl.appendChild(liEl);
    });
  };

  var delay = (function(){
    var timer = 0;
    return function(callback, ms){
      $timeout.cancel(timer);
      timer = $timeout(callback, ms);
    };
  })();

  var loadList = function(scope) {
    var inputEl = scope.inputEl, ulEl = scope.ulEl;
    while(ulEl.firstChild) { 
      ulEl.removeChild(ulEl.firstChild);
    }
    if (scope.source.constructor.name == 'Array') { // local source
      var filteredData = $filter('filter')(scope.source, inputEl.value);
      ulEl.style.display = 'block';
      addListElements(scope, filteredData);
    } else { // remote source
      ulEl.style.display = 'none';
      if (inputEl.value.length >= scope.minChars) {
        ulEl.style.display = 'block';
        showLoading(ulEl, true);
        AutoComplete.getRemoteData(
          scope.source, {keyword: inputEl.value}, scope.pathToData).then(
          function(data) {
            showLoading(ulEl, false);
            addListElements(scope, data);
          }, function(){
            showLoading(ulEl, false);
          });
      } // if
    } // else remote source
  };

  var hideAutoselect = function(scope) {
    var elToHide = scope.isMultiple ? scope.ulEl : scope.containerEl;
    elToHide.style.display = 'none';
  };

  var focusInputEl = function(scope) {
    scope.ulEl.style.display = 'block'; 
    scope.inputEl.focus();
    scope.inputEl.value = '';
    loadList(scope);
  };

  var inputElKeyHandler = function(scope, keyCode) {
    var selected = scope.ulEl.querySelector('.selected');
    switch(keyCode) {
      case 27: // ESC
        selected.className = '';
        hideAutoselect(scope); 
        break;
      case 38: // UP
        if (selected.previousSibling) {
          selected.className = '';
          selected.previousSibling.className = 'selected';
        }
        break;
      case 40: // DOWN
        scope.ulEl.style.display = 'block';
        if (selected && selected.nextSibling) {
          selected.className = '';
          selected.nextSibling.className = 'selected';
        } else if (!selected) {
          scope.ulEl.firstChild.className = 'selected';
        }
        break;
      case 13: // ENTER
        selected && scope.select(selected);
        break;
      case 8: // BACKSPACE
        // remove the last element for multiple and empty input
        if (scope.isMultiple && scope.inputEl.value === '') {
          $timeout(function() {
            scope.ngModel.pop();
          });
        }
    }
  };

  var linkFunc = function(scope, element, attrs) {
    var containerEl = element[0];
    var controlEl = element[0].controlEl;
    var inputEl, ulEl, isMultiple;
    controlEl && (controlEl.readOnly = true);
    scope.containerEl = containerEl;
    scope.isMultiple = isMultiple = containerEl.hasAttribute('multiple');
    scope.inputEl = inputEl = element[0].querySelector('input');
    scope.ulEl = ulEl = element[0].querySelector('ul');

    // add default class css to head tag
    if (scope.defaultStyle !== false) {
      containerEl.className += ' default-style';
      AutoComplete.injectDefaultStyle();
    }

    isMultiple && 
      inputEl.parentNode.parentNode.addEventListener('click', function() {
        focusInputEl(scope);
      });

    scope.select = function(liEl) {
      liEl.className = '';
      hideAutoselect(scope);
      $timeout(function() {
        if (attrs.ngModel) {
          if (controlEl.tagName == 'INPUT') {
            scope.ngModel = liEl.innerHTML ;
          } else if (controlEl.tagName == 'SELECT') {
            var optionValue = liEl.objectValue || liEl.innerHTML;
            scope.ngModel = optionValue;
            controlEl.firstChild.innerText =  liEl.innerHTML;
            controlEl.valueObject = liEl.object;
          } else if (isMultiple) {
            scope.ngModel.push(liEl.object);
          }
        }
        inputEl.value = '';
        scope.valueChanged({value: liEl.object}); //user scope
      });
    };

    inputEl.addEventListener('focus', function(evt) {
      focusInputEl(scope);
    }); 

    inputEl.addEventListener('blur', function() {
      hideAutoselect(scope);
    }); // hide list

    inputEl.addEventListener('keydown', function(evt) {
      inputElKeyHandler(scope, evt.keyCode);
    });

    ulEl.addEventListener('mousedown', function(evt) { 
      evt.target.tagName == 'LI' && scope.select(evt.target);
    });

    /** when enters text to search, reload the list */
    inputEl.addEventListener('input', function() {
      var delayMs = scope.source.constructor.name == 'Array' ? 10 : 500;
      delay(function() { //executing after user stopped typing
        loadList(scope);
      }, delayMs);

      isMultiple && inputEl.setAttribute('size', inputEl.value.length+1);
    });

  };

  var autoCompleteDiv =
    function(_$timeout_, _$filter_, _$compile_, _AutoComplete_) {
      $timeout = _$timeout_;
      $filter = _$filter_;
      $compile = _$compile_;
      AutoComplete = _AutoComplete_;

      return {
        restrict: 'E',
        scope: {
          ngModel : '=', 
          source : '=', 
          minChars : '=', 
          defaultStyle : '=', 
          pathToData : '@', 
          valueProperty: '@',
          displayProperty: '@',
          valueChanged : '&'
        },
        link: linkFunc 
      };
    };

  angular.module('angularjs-autocomplete').
    directive('autoCompleteDiv', autoCompleteDiv);
})();

(function(){
  'use strict';
  var $q, $http;

  var defaultStyle = 
    'auto-complete-div.default-style input {'+
    '  outline: none; '+
    '  border: 2px solid transparent;'+
    '  border-width: 3px 2px;'+
    '  margin: 0;'+
    '  box-sizing: border-box;'+
    '  background-clip: content-box;'+
    '}' + 

    'select ~ auto-complete-div.default-style input {'+
    '  border-width: 3px 7px;'+
    '}' + 

    'auto-complete-div.default-style ul {'+
    '  background-color: #fff;'+
    '  margin-top: 2px;'+
    '  display : none;'+
    '  width : 100%;'+
    '  overflow-y: auto;'+
    '  list-style-type: none;'+
    '  margin: 0;'+
    '  padding: 0;'+
    '  border: 1px solid #ccc;'+
    '  box-sizing: border-box;'+
    '}' + 

    'auto-complete-div.default-style ul li {'+
    '  padding: 2px 5px;'+
    '  border-bottom: 1px solid #eee;'+
    '}' + 

    'auto-complete-div.default-style ul li.selected {'+
    '  background-color: #ccc;'+
    '}' + 

    'auto-complete-div.default-style ul li:last-child {'+
    '  border-bottom: none;'+
    '}' + 

    'auto-complete-div.default-style ul li:hover {'+
    '  background-color: #ccc;'+
    '}' + 

    'div .auto-complete-repeat {'+
    '  display: inline-block;'+
    '  padding: 3px; '+
    '  background : #fff;'+
    '  margin: 3px;' +
    '  border: 1px solid #ccc;' +
    '  border-radius: 5px;' +
    '}' +

    'div .auto-complete-repeat .delete {'+
    '  margin: 0 3px;' +
    '  color: red;' +
    '  border: none;' +
    '  background-color: transparent; ' +
    '}' +

    'div .auto-complete-repeat .delete[disabled] {'+
    '  display: none;' +
    '}' +

    'auto-complete-div[multiple].default-style {'+
    '  position: relative;' +
    '  display: inline-block;' +
    '}' +

    'auto-complete-div[multiple].default-style input {'+
    '  background-color: transparent;'+
    '  border: none;' +
    '  border-radius: 0;' +
    '}' +

    'auto-complete-div[multiple].default-style ul {'+
    '  position: absolute;'+
    '  top: 1.5em;'+
    '  left: 0;'+
    '  width: auto;' +
    '  min-width: 10em;'+
    '}' +
    '';

  // return dasherized from  underscored/camelcased string
  var dasherize = function(string) {
    return string.replace(/_/g, '-').
      replace(/([a-z])([A-Z])/g, function(_,$1, $2) {
        return $1+'-'+$2.toLowerCase();
      });
  };

  // get style string of an element
  var getStyle = function(el,styleProp) {
    return document.defaultView.
      getComputedStyle(el,null).
      getPropertyValue(styleProp);
  };

  var injectDefaultStyleToHead = function() {
    if (!document.querySelector('style#auto-complete-style')) {
      var htmlDiv = document.createElement('div');
      htmlDiv.innerHTML = '<b>1</b>'+ 
        '<style id="auto-complete-style">' +
        defaultStyle +
        '</style>';
      document.getElementsByTagName('head')[0].
        appendChild(htmlDiv.childNodes[1]);
    }
  };

  var getRemoteData = function(source, query, pathToData) {
    var deferred = $q.defer(), httpGet;
    if (typeof source == 'string') {
      var keyValues = []; 
      for (var key in query) { // replace all keyword to value
        var regexp = new RegExp(key, 'g');
        if (source.match(regexp)) {
          source = source.replace(regexp, query[key]);
        } else {
          keyValues.push(key + "=" + query[key]);
        }
      }
      if (keyValues.length) {
        var qs = keyValues.join("&");
        source += source.match(/\?[a-z]/i) ? qs : ('?' + qs);
      }
      httpGet = $http.get(source);
    } else if (source.$promise) { 
      httpGet = source(query).$promise;
    } else if (typeof source == 'function') {
      httpGet = source(query);
      httpGet.$promise && (httpGet = source(query).$promise);
      if (!httpGet.then) {
        throw "source function must return a promise";
      }
    }

    httpGet.then(
      function(resp) {
        var list = resp.constructor.name == 'Resource' ? resp : resp.data;
        if (pathToData) {
          var paths = pathToData.split('.');
          paths.forEach(function(el) {
            list = list[el];
          });
        }
        deferred.resolve(list);
      }, 
      function(error) {
        deferred.reject(error);
      }
    );

    return deferred.promise;
  };

  angular.module('angularjs-autocomplete').
    factory('AutoComplete', function(_$q_, _$http_) {
      $q = _$q_, $http = _$http_;
      return {
        defaultStyle: defaultStyle,
        dasherize: dasherize,
        getStyle: getStyle,
        getRemoteData: getRemoteData,
        injectDefaultStyle: injectDefaultStyleToHead
      };
    });
})();