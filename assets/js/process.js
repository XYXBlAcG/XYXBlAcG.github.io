document.addEventListener('readystatechange', function () {   
    if(document.readyState === 'interactive') {     
       document.querySelector('.progress div').style.width = '33%'  
    }    
    if(document.readyState === 'complete') {
       document.querySelector('.progress div').style.width = '66%'   
    } 
  } ) 
  window.onload = function () {
     document.querySelector('.abc div').style.width = '100%' 
  }