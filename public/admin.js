document.querySelector('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button'),error=document.querySelector('#error');error.textContent='';button.disabled=true;
 try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const result=await response.json();if(!response.ok)throw Error(result.error);location.assign('/workspace');}catch(e){error.textContent=e.message;}finally{button.disabled=false;}
});
