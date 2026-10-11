import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import PrintOrder from './page';
const state=vi.hoisted(()=>({error:false}));
vi.mock('next/navigation',()=>({useParams:()=>({id:'order-test'})}));
vi.mock('@/src/services/api/ordersApi',()=>({
 useGetOrderDetailsQuery:()=>({isError:state.error,data:{orderNumber:'ORD-TEST',clinic:'Клиника',patientFullName:'Пациент',doctorFullName:'Врач',deadline:'2030-01-01',totalPrice:987654}}),
 useGetOrderKanbanQuery:()=>({data:[{title:'Гипсовка',tasks:[{id:'task',workTypeName:'Коронка',toothNumbers:[11,12],quantity:2,colorCode:null,materialNames:['Цирконий'],dentalTechnicianFullName:'Техник'}]}]}),
}));
vi.mock('@/src/services/api/laboratoryCaseApi',()=>({useGetLaboratoryCaseQuery:()=>({data:{state:{details:{channel:'DIGITAL',prescription:'Задание врача',modelSystem:'Модель TEST'}}}})}));
beforeEach(()=>{state.error=false;});
it('prints work instructions and technical snapshot without financial totals',()=>{
 const print=vi.spyOn(window,'print').mockImplementation(()=>{});render(<PrintOrder/>);
 expect(screen.getByText('Наряд № ORD-TEST')).toBeInTheDocument();expect(screen.getByText(/Коронка/)).toBeInTheDocument();
 expect(screen.getByText(/Не требуется/)).toBeInTheDocument();expect(screen.getByText('Модель TEST')).toBeInTheDocument();expect(screen.queryByText('987654')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Печать / PDF'}));expect(print).toHaveBeenCalledOnce();
});
it('does not offer printing when the order failed to load',()=>{state.error=true;render(<PrintOrder/>);expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Печать / PDF'})).not.toBeInTheDocument();});
