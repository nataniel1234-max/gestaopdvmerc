export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caixas: {
        Row: {
          aberto_em: string
          comercio_id: string
          created_at: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          operador: string | null
          qtd_vendas: number
          status: string
          total_credito: number
          total_debito: number
          total_despesas: number
          total_dinheiro: number
          total_fiado: number
          total_pix: number
          total_recebimentos_fiado: number
          total_sangrias: number
          total_suprimentos: number
          updated_at: string
          valor_abertura: number
          valor_fechamento_calculado: number | null
          valor_fechamento_informado: number | null
        }
        Insert: {
          aberto_em?: string
          comercio_id?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          operador?: string | null
          qtd_vendas?: number
          status?: string
          total_credito?: number
          total_debito?: number
          total_despesas?: number
          total_dinheiro?: number
          total_fiado?: number
          total_pix?: number
          total_recebimentos_fiado?: number
          total_sangrias?: number
          total_suprimentos?: number
          updated_at?: string
          valor_abertura?: number
          valor_fechamento_calculado?: number | null
          valor_fechamento_informado?: number | null
        }
        Update: {
          aberto_em?: string
          comercio_id?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          operador?: string | null
          qtd_vendas?: number
          status?: string
          total_credito?: number
          total_debito?: number
          total_despesas?: number
          total_dinheiro?: number
          total_fiado?: number
          total_pix?: number
          total_recebimentos_fiado?: number
          total_sangrias?: number
          total_suprimentos?: number
          updated_at?: string
          valor_abertura?: number
          valor_fechamento_calculado?: number | null
          valor_fechamento_informado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          comercio_id: string
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          limite_credito: number
          nome: string
          observacoes: string | null
          permite_fiado: boolean
          saldo_devedor: number
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          limite_credito?: number
          nome: string
          observacoes?: string | null
          permite_fiado?: boolean
          saldo_devedor?: number
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          limite_credito?: number
          nome?: string
          observacoes?: string | null
          permite_fiado?: boolean
          saldo_devedor?: number
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      comercio_cupom_config: {
        Row: {
          cabecalho: string | null
          comercio_id: string
          created_at: string
          id: string
          mensagem_promocional: string | null
          mostrar_cnpj: boolean
          mostrar_endereco: boolean
          mostrar_telefone: boolean
          proximo_numero: number
          rodape: string | null
          serie: string
          updated_at: string
        }
        Insert: {
          cabecalho?: string | null
          comercio_id?: string
          created_at?: string
          id?: string
          mensagem_promocional?: string | null
          mostrar_cnpj?: boolean
          mostrar_endereco?: boolean
          mostrar_telefone?: boolean
          proximo_numero?: number
          rodape?: string | null
          serie?: string
          updated_at?: string
        }
        Update: {
          cabecalho?: string | null
          comercio_id?: string
          created_at?: string
          id?: string
          mensagem_promocional?: string | null
          mostrar_cnpj?: boolean
          mostrar_endereco?: boolean
          mostrar_telefone?: boolean
          proximo_numero?: number
          rodape?: string | null
          serie?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercio_cupom_config_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: true
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      comercio_formas_pagamento: {
        Row: {
          ativo: boolean
          comercio_id: string
          created_at: string
          id: string
          nome: string
          ordem: number
          prazo_recebimento_dias: number
          taxa_percentual: number
          tipo_base: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          prazo_recebimento_dias?: number
          taxa_percentual?: number
          tipo_base: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          prazo_recebimento_dias?: number
          taxa_percentual?: number
          tipo_base?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercio_formas_pagamento_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      comercio_naturezas_lancamento: {
        Row: {
          ativo: boolean
          comercio_id: string
          created_at: string
          descricao: string
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          descricao: string
          id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comercio_id?: string
          created_at?: string
          descricao?: string
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercio_naturezas_lancamento_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      comercios: {
        Row: {
          created_at: string
          documento: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          documento?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          documento?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          comercio_id: string
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          comercio_id?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          comercio_id?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_nota_entrada: {
        Row: {
          comercio_id: string
          id: string
          nota_id: string
          preco_custo_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          comercio_id?: string
          id?: string
          nota_id: string
          preco_custo_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          comercio_id?: string
          id?: string
          nota_id?: string
          preco_custo_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_nota_entrada_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_nota_entrada_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_nota_entrada_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_venda: {
        Row: {
          comercio_id: string
          id: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          comercio_id?: string
          id?: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          comercio_id?: string
          id?: string
          preco_unitario?: number
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          caixa_id: string
          comercio_id: string
          created_at: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor: number
        }
        Insert: {
          caixa_id: string
          comercio_id?: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor: number
        }
        Update: {
          caixa_id?: string
          comercio_id?: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          comercio_id: string
          created_at: string
          custo_unitario: number | null
          estoque_anterior: number
          estoque_novo: number
          id: string
          motivo: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes: string | null
          produto_id: string
          quantidade: number
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Insert: {
          comercio_id?: string
          created_at?: string
          custo_unitario?: number | null
          estoque_anterior: number
          estoque_novo: number
          id?: string
          motivo: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes?: string | null
          produto_id: string
          quantidade: number
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Update: {
          comercio_id?: string
          created_at?: string
          custo_unitario?: number | null
          estoque_anterior?: number
          estoque_novo?: number
          id?: string
          motivo?: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_entrada: {
        Row: {
          comercio_id: string
          created_at: string
          data_entrada: string
          fornecedor_id: string | null
          id: string
          numero_nota: string | null
          observacoes: string | null
          valor_total: number
        }
        Insert: {
          comercio_id?: string
          created_at?: string
          data_entrada?: string
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number
        }
        Update: {
          comercio_id?: string
          created_at?: string
          data_entrada?: string
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_entrada_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_entrada_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_fiado: {
        Row: {
          caixa_id: string | null
          cliente_id: string
          comercio_id: string
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          valor: number
        }
        Insert: {
          caixa_id?: string | null
          cliente_id: string
          comercio_id?: string
          created_at?: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          valor: number
        }
        Update: {
          caixa_id?: string | null
          cliente_id?: string
          comercio_id?: string
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_fiado_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fiado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fiado_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo_barras: string | null
          comercio_id: string
          created_at: string
          descricao: string | null
          estoque_atual: number
          estoque_minimo: number
          fornecedor_id: string | null
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          comercio_id?: string
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          comercio_id?: string
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          comercio_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          comercio_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          comercio_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          caixa_id: string | null
          cancelada: boolean
          cliente_id: string | null
          comercio_id: string
          created_at: string
          desconto: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          numero_cupom: number
          observacoes: string | null
          subtotal: number
          total: number
          troco: number | null
          valor_recebido: number | null
        }
        Insert: {
          caixa_id?: string | null
          cancelada?: boolean
          cliente_id?: string | null
          comercio_id?: string
          created_at?: string
          desconto?: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          numero_cupom?: number
          observacoes?: string | null
          subtotal?: number
          total?: number
          troco?: number | null
          valor_recebido?: number | null
        }
        Update: {
          caixa_id?: string | null
          cancelada?: boolean
          cliente_id?: string | null
          comercio_id?: string
          created_at?: string
          desconto?: number
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          numero_cupom?: number
          observacoes?: string | null
          subtotal?: number
          total?: number
          troco?: number | null
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      caixa_aberto: { Args: never; Returns: string }
      current_user_comercio: { Args: never; Returns: string }
      has_role: {
        Args: {
          _comercio_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: {
        Args: { _comercio_id: string; _user_id: string }
        Returns: boolean
      }
      seed_comercio_defaults: {
        Args: { _comercio_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "dono" | "operador"
      forma_pagamento: "dinheiro" | "debito" | "credito" | "pix" | "fiado"
      movimentacao_motivo:
        | "compra"
        | "venda"
        | "troca"
        | "vencido"
        | "roubo"
        | "depreciacao"
        | "furo_estoque"
        | "outro"
      movimentacao_tipo:
        | "entrada_compra"
        | "saida_venda"
        | "saida_troca"
        | "saida_perda"
        | "ajuste"
      tipo_mov_caixa:
        | "abertura"
        | "sangria"
        | "suprimento"
        | "despesa"
        | "venda"
        | "recebimento_fiado"
        | "fechamento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["dono", "operador"],
      forma_pagamento: ["dinheiro", "debito", "credito", "pix", "fiado"],
      movimentacao_motivo: [
        "compra",
        "venda",
        "troca",
        "vencido",
        "roubo",
        "depreciacao",
        "furo_estoque",
        "outro",
      ],
      movimentacao_tipo: [
        "entrada_compra",
        "saida_venda",
        "saida_troca",
        "saida_perda",
        "ajuste",
      ],
      tipo_mov_caixa: [
        "abertura",
        "sangria",
        "suprimento",
        "despesa",
        "venda",
        "recebimento_fiado",
        "fechamento",
      ],
    },
  },
} as const
